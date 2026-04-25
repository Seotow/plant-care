"""API router for managing disease classes (including user-uploaded diseases)."""
import uuid
import logging
import cv2
import numpy as np
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, UploadFile, Request, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, DiseaseClass, DiseasePrototype, DiseaseSample
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/diseases", tags=["diseases"])
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "diseases"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MIN_SAMPLES = 3
MAX_SAMPLES = 50


@router.get("/")
def list_diseases(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    diseases = db.query(DiseaseClass).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "name_vi": d.name_vi,
            "is_builtin": bool(d.is_builtin),
            "sample_count": d.prototype.sample_count if d.prototype else 0,
            "created_at": d.created_at.isoformat(),
        }
        for d in diseases
    ]


@router.post("/")
async def create_disease(
    request: Request,
    name: str = Form(...),
    name_vi: str = Form(""),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(files) < MIN_SAMPLES:
        raise HTTPException(
            status_code=400,
            detail=f"Cần ít nhất {MIN_SAMPLES} ảnh mẫu (nhận được {len(files)})",
        )
    if len(files) > MAX_SAMPLES:
        raise HTTPException(
            status_code=400,
            detail=f"Tối đa {MAX_SAMPLES} ảnh mẫu (nhận được {len(files)})",
        )

    existing = db.query(DiseaseClass).filter(DiseaseClass.name == name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Bệnh '{name}' đã tồn tại")

    predictor = request.app.state.predictor
    if not hasattr(predictor, "compute_embedding"):
        raise HTTPException(status_code=501, detail="Embedding model chưa được tải")

    # Create disease class
    disease = DiseaseClass(name=name, name_vi=name_vi or name, created_by=user.id)
    db.add(disease)
    db.commit()
    db.refresh(disease)

    # Process each uploaded image
    embeddings = []
    for file in files:
        contents = await file.read()
        img_array = np.frombuffer(contents, np.uint8)
        img_bgr = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img_bgr is None:
            continue

        filename = f"{uuid.uuid4().hex}.jpg"
        save_path = UPLOAD_DIR / filename
        cv2.imwrite(str(save_path), img_bgr)

        embedding = predictor.compute_embedding(img_bgr)
        emb_bytes = embedding.tobytes()
        embeddings.append(embedding)

        sample = DiseaseSample(
            disease_class_id=disease.id,
            image_path=f"diseases/{filename}",
            embedding=emb_bytes,
        )
        db.add(sample)

    if len(embeddings) < MIN_SAMPLES:
        db.delete(disease)
        db.commit()
        raise HTTPException(status_code=400, detail="Không đủ ảnh hợp lệ")

    # Compute prototype: mean → L2 normalize
    mean_emb = np.mean(embeddings, axis=0).astype(np.float32)
    mean_emb = mean_emb / (np.linalg.norm(mean_emb) + 1e-8)

    prototype = DiseasePrototype(
        disease_class_id=disease.id,
        embedding=mean_emb.tobytes(),
        sample_count=len(embeddings),
    )
    db.add(prototype)
    db.commit()

    # Reload predictor prototypes
    predictor.reload_prototypes(db)

    return {
        "id": disease.id,
        "name": disease.name,
        "name_vi": disease.name_vi,
        "sample_count": len(embeddings),
        "message": f"Đã thêm bệnh '{name}' với {len(embeddings)} ảnh mẫu",
    }


@router.post("/{disease_id}/samples")
async def add_samples(
    disease_id: int,
    request: Request,
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    disease = db.query(DiseaseClass).filter(DiseaseClass.id == disease_id).first()
    if not disease:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh")

    predictor = request.app.state.predictor
    new_embeddings = []

    for file in files:
        contents = await file.read()
        img_array = np.frombuffer(contents, np.uint8)
        img_bgr = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img_bgr is None:
            continue

        filename = f"{uuid.uuid4().hex}.jpg"
        save_path = UPLOAD_DIR / filename
        cv2.imwrite(str(save_path), img_bgr)

        embedding = predictor.compute_embedding(img_bgr)
        new_embeddings.append(embedding)

        sample = DiseaseSample(
            disease_class_id=disease.id,
            image_path=f"diseases/{filename}",
            embedding=embedding.tobytes(),
        )
        db.add(sample)

    if not new_embeddings:
        raise HTTPException(status_code=400, detail="Không có ảnh hợp lệ")

    # Recompute prototype from ALL samples
    all_samples = db.query(DiseaseSample).filter(
        DiseaseSample.disease_class_id == disease.id
    ).all()

    all_embs = [np.frombuffer(s.embedding, dtype=np.float32) for s in all_samples]
    mean_emb = np.mean(all_embs, axis=0)
    mean_emb = mean_emb / (np.linalg.norm(mean_emb) + 1e-8)

    prototype = disease.prototype
    if prototype:
        prototype.embedding = mean_emb.tobytes()
        prototype.sample_count = len(all_samples)
    else:
        prototype = DiseasePrototype(
            disease_class_id=disease.id,
            embedding=mean_emb.tobytes(),
            sample_count=len(all_samples),
        )
        db.add(prototype)

    db.commit()
    predictor.reload_prototypes(db)

    return {
        "disease_id": disease.id,
        "new_samples": len(new_embeddings),
        "total_samples": len(all_samples),
        "message": f"Đã thêm {len(new_embeddings)} ảnh mẫu",
    }


@router.patch("/{disease_id}")
def update_disease(
    disease_id: int,
    request: Request,
    name: str = Form(...),
    name_vi: str = Form(""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    disease = db.query(DiseaseClass).filter(DiseaseClass.id == disease_id).first()
    if not disease:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh")
    if disease.is_builtin:
        raise HTTPException(status_code=403, detail="Không thể chỉnh sửa bệnh mặc định")

    conflict = (
        db.query(DiseaseClass)
        .filter(DiseaseClass.name == name, DiseaseClass.id != disease_id)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail=f"Tên '{name}' đã được dùng bởi bệnh khác")

    disease.name = name
    disease.name_vi = name_vi or name
    db.commit()

    predictor = request.app.state.predictor
    predictor.reload_prototypes(db)

    return {"id": disease.id, "name": disease.name, "name_vi": disease.name_vi}


@router.delete("/{disease_id}")
def delete_disease(
    disease_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    disease = db.query(DiseaseClass).filter(DiseaseClass.id == disease_id).first()
    if not disease:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh")
    if disease.is_builtin:
        raise HTTPException(status_code=403, detail="Không thể xóa bệnh mặc định")

    name = disease.name
    image_paths = [s.image_path for s in disease.samples]

    db.delete(disease)
    db.commit()

    uploads_root = UPLOAD_DIR.parent
    for rel_path in image_paths:
        file_path = uploads_root / rel_path
        try:
            file_path.unlink(missing_ok=True)
        except Exception:
            logger.warning("Không thể xóa file ảnh: %s", rel_path)

    predictor = request.app.state.predictor
    predictor.reload_prototypes(db)

    return {"message": f"Đã xóa bệnh '{name}'"}
