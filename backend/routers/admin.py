"""Router dành riêng cho admin.

Các chức năng:
- Xem danh sách đề xuất bệnh (pending / approved / rejected)
- Duyệt đề xuất → tạo DiseaseClass + DiseasePrototype vào hệ thống
- Từ chối đề xuất kèm lý do
"""
import uuid
import logging
import cv2
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, Form, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import json

from models import (
    User, DiseaseSubmission, DiseaseClass, DiseasePrototype, DiseaseSample,
    DiseaseKnowledge,
)
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

UPLOADS_ROOT = Path(__file__).resolve().parent.parent / "uploads"
DISEASE_DIR = UPLOADS_ROOT / "diseases"
DISEASE_DIR.mkdir(parents=True, exist_ok=True)


# ─── Dependency: kiểm tra quyền admin ───────────────────────────────────────

def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Chỉ admin mới được thực hiện thao tác này")
    return user


# ─── Quản lý đề xuất ─────────────────────────────────────────────────────────

@router.get("/submissions")
def admin_list_submissions(
    status: str = "pending",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(DiseaseSubmission)
    if status != "all":
        q = q.filter(DiseaseSubmission.status == status)
    subs = q.order_by(DiseaseSubmission.created_at.desc()).all()

    result = []
    for s in subs:
        submitter = db.query(User).filter(User.id == s.submitted_by).first()
        result.append({
            "id": s.id,
            "name": s.name,
            "name_vi": s.name_vi,
            "symptoms": s.symptoms,
            "status": s.status,
            "reject_reason": s.reject_reason,
            "sample_count": len(s.samples),
            "sample_images": [f"/uploads/{sp.image_path}" for sp in s.samples[:4]],
            "submitted_by": submitter.username if submitter else "",
            "created_at": s.created_at.isoformat(),
        })
    return result


@router.post("/submissions/{submission_id}/approve")
async def approve_submission(
    submission_id: int,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    submission = db.query(DiseaseSubmission).filter(DiseaseSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề xuất")
    if submission.status != "pending":
        raise HTTPException(status_code=400, detail="Đề xuất này đã được xử lý rồi")

    # Kiểm tra bệnh trùng tên
    existing = db.query(DiseaseClass).filter(DiseaseClass.name == submission.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Bệnh '{submission.name}' đã tồn tại trong hệ thống")

    predictor = request.app.state.predictor
    if not hasattr(predictor, "compute_embedding"):
        raise HTTPException(status_code=501, detail="Embedding model chưa được tải")

    # Tạo DiseaseClass
    disease = DiseaseClass(
        name=submission.name,
        name_vi=submission.name_vi,
        created_by=submission.submitted_by,
    )
    db.add(disease)
    db.commit()
    db.refresh(disease)

    # Tính embedding từ ảnh mẫu đề xuất → tạo DiseaseSample + DiseasePrototype
    embeddings = []
    for sub_sample in submission.samples:
        img_path = UPLOADS_ROOT / sub_sample.image_path
        if not img_path.exists():
            continue
        img_bgr = cv2.imread(str(img_path))
        if img_bgr is None:
            continue

        filename = f"{uuid.uuid4().hex}.jpg"
        cv2.imwrite(str(DISEASE_DIR / filename), img_bgr)

        embedding = predictor.compute_embedding(img_bgr)
        embeddings.append(embedding)

        db.add(DiseaseSample(
            disease_class_id=disease.id,
            image_path=f"diseases/{filename}",
            embedding=embedding.tobytes(),
        ))

    if not embeddings:
        db.delete(disease)
        db.commit()
        raise HTTPException(status_code=400, detail="Không thể tính embedding từ ảnh mẫu")

    mean_emb = np.mean(embeddings, axis=0).astype(np.float32)
    mean_emb = mean_emb / (np.linalg.norm(mean_emb) + 1e-8)

    db.add(DiseasePrototype(
        disease_class_id=disease.id,
        embedding=mean_emb.tobytes(),
        sample_count=len(embeddings),
    ))

    submission.status = "approved"
    submission.reviewed_by = admin.id
    submission.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    predictor.reload_prototypes(db)
    logger.info("Admin %d duyệt submission %d → disease %d (%s)", admin.id, submission_id, disease.id, disease.name)

    return {
        "message": f"Đã duyệt và thêm bệnh '{submission.name}' vào hệ thống",
        "disease_id": disease.id,
        "sample_count": len(embeddings),
    }


@router.post("/submissions/{submission_id}/reject")
def reject_submission(
    submission_id: int,
    reason: str = Form(""),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    submission = db.query(DiseaseSubmission).filter(DiseaseSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề xuất")
    if submission.status != "pending":
        raise HTTPException(status_code=400, detail="Đề xuất này đã được xử lý rồi")

    submission.status = "rejected"
    submission.reject_reason = reason
    submission.reviewed_by = admin.id
    submission.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    logger.info("Admin %d từ chối submission %d: %s", admin.id, submission_id, reason)
    return {"message": f"Đã từ chối đề xuất '{submission.name}'"}


# ─── Thông tin admin ──────────────────────────────────────────────────────────

@router.get("/me")
def admin_info(admin: User = Depends(require_admin)):
    return {"is_admin": True, "username": admin.username, "full_name": admin.full_name}


# ─── Quản lý knowledge base ───────────────────────────────────────────────────

@router.get("/knowledge")
def admin_list_knowledge(
    search: str = "",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(DiseaseKnowledge)
    if search:
        q = q.filter(DiseaseKnowledge.label.ilike(f"%{search}%"))
    entries = q.order_by(DiseaseKnowledge.label).all()
    return [
        {
            "id": e.id,
            "label": e.label,
            "mo_ta": e.mo_ta,
            "nguyen_nhan": e.nguyen_nhan,
            "xu_ly": e.xu_ly,
        }
        for e in entries
    ]


@router.get("/knowledge/{knowledge_id}")
def admin_get_knowledge(
    knowledge_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entry = db.query(DiseaseKnowledge).filter(DiseaseKnowledge.id == knowledge_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi knowledge")
    return {
        "id": entry.id,
        "label": entry.label,
        "mo_ta": entry.mo_ta,
        "nguyen_nhan": entry.nguyen_nhan,
        "xu_ly": entry.xu_ly,
    }


@router.patch("/knowledge/{knowledge_id}")
def admin_update_knowledge(
    knowledge_id: int,
    mo_ta: str = Form(""),
    nguyen_nhan: str = Form(""),
    xu_ly: str = Form("[]"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entry = db.query(DiseaseKnowledge).filter(DiseaseKnowledge.id == knowledge_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi knowledge")

    try:
        parsed = json.loads(xu_ly)
        if not isinstance(parsed, list):
            raise ValueError
    except Exception:
        raise HTTPException(status_code=422, detail="xu_ly phải là mảng JSON hợp lệ (danh sách chuỗi)")

    entry.mo_ta = mo_ta
    entry.nguyen_nhan = nguyen_nhan
    entry.xu_ly = json.dumps(parsed, ensure_ascii=False)
    db.commit()

    return {
        "id": entry.id,
        "label": entry.label,
        "mo_ta": entry.mo_ta,
        "nguyen_nhan": entry.nguyen_nhan,
        "xu_ly": entry.xu_ly,
    }
