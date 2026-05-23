"""API router for managing disease classes.

POST / và POST /{id}/samples chỉ dành cho admin.
Người dùng thường phải dùng /api/submissions để đề xuất bệnh.
"""
import json
import uuid
import logging
import cv2
import numpy as np
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, UploadFile, Request, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, DiseaseClass, DiseaseKnowledge, DiseasePrototype, DiseaseSample
from auth import get_current_user
from utils.slug import make_disease_slug


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền tạo/sửa bệnh trực tiếp. Hãy dùng tính năng Đề xuất bệnh.")
    return user

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
            "plant_name_vi": d.plant_name_vi or "",
            "disease_name_vi": d.disease_name_vi or "",
            "treatment": d.treatment or "",
            "is_newly_approved": bool(d.is_newly_approved),
            "is_builtin": bool(d.is_builtin),
            "sample_count": d.prototype.sample_count if d.prototype else 0,
            "created_at": d.created_at.isoformat(),
        }
        for d in diseases
    ]


@router.get("/knowledge")
def list_knowledge_public(
    search: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Public knowledge list - readable by any authenticated user."""
    q = db.query(DiseaseKnowledge)
    if search:
        q = q.filter(DiseaseKnowledge.label.ilike(f"%{search}%"))
    entries = q.order_by(DiseaseKnowledge.label).all()

    result = []
    for e in entries:
        disease_class = None
        if e.disease_class_id:
            disease_class = db.query(DiseaseClass).filter(DiseaseClass.id == e.disease_class_id).first()
        if not disease_class:
            disease_class = db.query(DiseaseClass).filter(DiseaseClass.name == e.label).first()
        result.append({
            "id": e.id,
            "label": e.label,
            "name_vi": disease_class.name_vi if disease_class else "",
            "is_newly_approved": bool(disease_class.is_newly_approved) if disease_class else False,
            "mo_ta": e.mo_ta,
            "nguyen_nhan": e.nguyen_nhan,
            "xu_ly": e.xu_ly,
        })
    return result


@router.post("/")
async def create_disease(
    request: Request,
    plant_name_vi: str = Form(...),
    disease_name_vi: str = Form(""),
    symptoms: str = Form(""),
    treatment: str = Form(""),
    files: list[UploadFile] = File(...),
    user: User = Depends(_require_admin),
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
    if not plant_name_vi.strip():
        raise HTTPException(status_code=400, detail="Tên cây không được để trống")

    predictor = request.app.state.predictor
    if not hasattr(predictor, "compute_embedding"):
        raise HTTPException(status_code=501, detail="Embedding model chưa được tải")

    name = make_disease_slug(db, plant_name_vi.strip(), disease_name_vi.strip())
    pnv = plant_name_vi.strip()
    dnv = disease_name_vi.strip()
    name_vi = f"{pnv} - {dnv}" if dnv else pnv

    # Create disease class
    disease = DiseaseClass(
        name=name,
        name_vi=name_vi,
        plant_name_vi=pnv,
        disease_name_vi=dnv,
        treatment=treatment.strip(),
        is_newly_approved=1,
        created_by=user.id,
    )
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

    # Upsert DiseaseKnowledge - reuse existing row if label already exists
    treat_str = treatment.strip()
    xu_ly = json.dumps([treat_str], ensure_ascii=False) if treat_str else "[]"
    kb = db.query(DiseaseKnowledge).filter(DiseaseKnowledge.label == name).first()
    if kb:
        kb.mo_ta = symptoms.strip()
        kb.xu_ly = xu_ly
        kb.disease_class_id = disease.id
    else:
        db.add(DiseaseKnowledge(
            label=name,
            mo_ta=symptoms.strip(),
            nguyen_nhan="",
            xu_ly=xu_ly,
            disease_class_id=disease.id,
        ))
    db.commit()

    # Reload predictor prototypes
    predictor.reload_prototypes(db)

    return {
        "id": disease.id,
        "name": disease.name,
        "name_vi": disease.name_vi,
        "plant_name_vi": disease.plant_name_vi,
        "disease_name_vi": disease.disease_name_vi,
        "sample_count": len(embeddings),
        "message": f"Đã thêm bệnh '{name_vi}' với {len(embeddings)} ảnh mẫu",
    }


@router.post("/{disease_id}/samples")
async def add_samples(
    disease_id: int,
    request: Request,
    files: list[UploadFile] = File(...),
    user: User = Depends(_require_admin),
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
    plant_name_vi: str = Form(...),
    disease_name_vi: str = Form(""),
    treatment: str = Form(""),
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    disease = db.query(DiseaseClass).filter(DiseaseClass.id == disease_id).first()
    if not disease:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh")
    if disease.is_builtin:
        raise HTTPException(status_code=403, detail="Không thể chỉnh sửa bệnh mặc định")
    if not plant_name_vi.strip():
        raise HTTPException(status_code=400, detail="Tên cây không được để trống")

    pnv = plant_name_vi.strip()
    dnv = disease_name_vi.strip()
    disease.plant_name_vi = pnv
    disease.disease_name_vi = dnv
    disease.treatment = treatment.strip()
    disease.name_vi = f"{pnv} - {dnv}" if dnv else pnv
    db.commit()

    predictor = request.app.state.predictor
    predictor.reload_prototypes(db)

    return {
        "id": disease.id,
        "name": disease.name,
        "name_vi": disease.name_vi,
        "plant_name_vi": disease.plant_name_vi,
        "disease_name_vi": disease.disease_name_vi,
    }


@router.delete("/{disease_id}")
def delete_disease(
    disease_id: int,
    request: Request,
    user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    disease = db.query(DiseaseClass).filter(DiseaseClass.id == disease_id).first()
    if not disease:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh")
    if disease.is_builtin:
        raise HTTPException(status_code=403, detail="Không thể xóa bệnh mặc định")

    name = disease.name
    image_paths = [s.image_path for s in disease.samples]

    # Delete linked DiseaseKnowledge entry so its label is freed for reuse
    kb = db.query(DiseaseKnowledge).filter(DiseaseKnowledge.disease_class_id == disease_id).first()
    if kb:
        db.delete(kb)

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
