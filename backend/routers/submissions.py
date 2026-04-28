"""Router cho luồng đề xuất bệnh của người dùng.

Người dùng gửi đề xuất kèm ảnh mẫu và mô tả triệu chứng.
Đề xuất ở trạng thái pending cho đến khi admin duyệt qua router admin.py.
"""
import uuid
import logging
import cv2
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, DiseaseSubmission, DiseaseSubmissionSample
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/submissions", tags=["submissions"])
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "submissions"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MIN_SAMPLES = 3
MAX_SAMPLES = 50


# ─── Người dùng: gửi đề xuất ────────────────────────────────────────────────

@router.post("/")
async def submit_disease(
    name: str = Form(...),
    name_vi: str = Form(""),
    symptoms: str = Form(""),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(files) < MIN_SAMPLES:
        raise HTTPException(status_code=400, detail=f"Cần ít nhất {MIN_SAMPLES} ảnh mẫu")
    if len(files) > MAX_SAMPLES:
        raise HTTPException(status_code=400, detail=f"Tối đa {MAX_SAMPLES} ảnh mẫu")

    # Kiểm tra trùng tên đang chờ duyệt
    dup = db.query(DiseaseSubmission).filter(
        DiseaseSubmission.name == name.strip(),
        DiseaseSubmission.status == "pending",
    ).first()
    if dup:
        raise HTTPException(status_code=409, detail="Đã có đề xuất bệnh này đang chờ duyệt")

    submission = DiseaseSubmission(
        name=name.strip(),
        name_vi=(name_vi or name).strip(),
        symptoms=symptoms.strip(),
        submitted_by=user.id,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    valid = 0
    for file in files:
        contents = await file.read()
        img_array = np.frombuffer(contents, np.uint8)
        img_bgr = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img_bgr is None:
            continue
        filename = f"{uuid.uuid4().hex}.jpg"
        cv2.imwrite(str(UPLOAD_DIR / filename), img_bgr)
        db.add(DiseaseSubmissionSample(
            submission_id=submission.id,
            image_path=f"submissions/{filename}",
        ))
        valid += 1

    if valid < MIN_SAMPLES:
        db.delete(submission)
        db.commit()
        raise HTTPException(status_code=400, detail="Không đủ ảnh hợp lệ (cần ít nhất 3 ảnh đọc được)")

    db.commit()
    logger.info("Submission %d tạo bởi user %d: %s (%d ảnh)", submission.id, user.id, name, valid)
    return {
        "id": submission.id,
        "name": submission.name,
        "status": submission.status,
        "message": f"Đề xuất '{name}' đã được gửi, đang chờ admin duyệt",
    }


@router.get("/mine")
def list_my_submissions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subs = (
        db.query(DiseaseSubmission)
        .filter(DiseaseSubmission.submitted_by == user.id)
        .order_by(DiseaseSubmission.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "name_vi": s.name_vi,
            "symptoms": s.symptoms,
            "status": s.status,
            "reject_reason": s.reject_reason,
            "sample_count": len(s.samples),
            "created_at": s.created_at.isoformat(),
        }
        for s in subs
    ]
