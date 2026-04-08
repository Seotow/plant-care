import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import User, Detection, Garden
from auth import get_current_user

router = APIRouter(prefix="/api/detections", tags=["history"])


@router.get("/")
def list_detections(
    garden_id: int = Query(None),
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Detection).filter(Detection.user_id == user.id)
    if garden_id:
        q = q.filter(Detection.garden_id == garden_id)
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
        "created_at": r.created_at.isoformat(),
    }
