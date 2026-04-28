import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, Detection, Garden, DiseaseKnowledge
from auth import get_current_user

router = APIRouter(prefix="/api/detections", tags=["history"])


@router.get("/")
def list_detections(
    garden_id: int = Query(None),
    limit: int = Query(50, le=200),
    from_date: str = Query(None),  # "YYYY-MM-DD"
    to_date: str = Query(None),    # "YYYY-MM-DD"
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Detection).filter(Detection.user_id == user.id)
    if garden_id:
        q = q.filter(Detection.garden_id == garden_id)
    if from_date:
        try:
            dt = datetime.fromisoformat(from_date)
            q = q.filter(Detection.created_at >= dt)
        except ValueError:
            pass
    if to_date:
        try:
            dt = datetime.fromisoformat(to_date) + timedelta(days=1)
            q = q.filter(Detection.created_at < dt)
        except ValueError:
            pass
    records = q.order_by(Detection.created_at.desc()).limit(limit).all()

    results = []
    for r in records:
        garden = db.query(Garden).filter(Garden.id == r.garden_id).first()
        results.append({
            "id": r.id,
            "garden_id": r.garden_id,
            "garden_name": garden.name if garden else "",
            "image_url": f"/uploads/{r.image_path}" if r.image_path else "",
            "disease_label": r.disease_label,
            "disease_label_vi": r.disease_label_vi or "",
            "confidence": r.confidence,
            "top_k": json.loads(r.top_k) if r.top_k else [],
            "created_at": r.created_at.isoformat(),
        })
    return results


@router.get("/{detection_id}")
def get_detection(
    detection_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    r = db.query(Detection).filter(Detection.id == detection_id, Detection.user_id == user.id).first()
    if not r:
        return {"error": "Không tìm thấy"}
    garden = db.query(Garden).filter(Garden.id == r.garden_id).first()

    # Lấy thông tin xử lý bệnh
    knowledge = db.query(DiseaseKnowledge).filter(DiseaseKnowledge.label == r.disease_label).first()
    disease_info = None
    if knowledge:
        import json as _json
        disease_info = {
            "mo_ta": knowledge.mo_ta,
            "nguyen_nhan": knowledge.nguyen_nhan,
            "xu_ly": _json.loads(knowledge.xu_ly) if knowledge.xu_ly else [],
        }

    return {
        "id": r.id,
        "garden_id": r.garden_id,
        "garden_name": garden.name if garden else "",
        "image_url": f"/uploads/{r.image_path}" if r.image_path else "",
        "disease_label": r.disease_label,
        "disease_label_vi": r.disease_label_vi or "",
        "confidence": r.confidence,
        "bbox": json.loads(r.bbox) if r.bbox else [],
        "top_k": json.loads(r.top_k) if r.top_k else [],
        "disease_info": disease_info,
        "created_at": r.created_at.isoformat(),
    }


@router.get("/garden/{garden_id}/progression")
def garden_progression(
    garden_id: int,
    days: int = Query(30, ge=7, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trả về số lần phát hiện bệnh theo từng ngày cho biểu đồ tiến triển (UC08)."""
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == user.id).first()
    if not garden:
        return {"error": "Không tìm thấy vườn"}

    cutoff = datetime.now() - timedelta(days=days)
    records = (
        db.query(Detection)
        .filter(Detection.garden_id == garden_id, Detection.created_at >= cutoff)
        .order_by(Detection.created_at.asc())
        .all()
    )

    # Nhóm theo ngày
    from collections import defaultdict
    day_counts: dict = defaultdict(lambda: {"total": 0, "diseased": 0})
    for r in records:
        day = r.created_at.strftime("%Y-%m-%d")
        day_counts[day]["total"] += 1
        if "healthy" not in (r.disease_label or "").lower():
            day_counts[day]["diseased"] += 1

    # Tạo chuỗi ngày liên tục trong khoảng
    labels = []
    total_series = []
    diseased_series = []
    for i in range(days):
        day = (datetime.now() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        labels.append(day)
        total_series.append(day_counts[day]["total"])
        diseased_series.append(day_counts[day]["diseased"])

    return {
        "garden_id": garden_id,
        "garden_name": garden.name,
        "days": days,
        "labels": labels,
        "total_series": total_series,
        "diseased_series": diseased_series,
    }
