import json
import uuid
import logging
import cv2
import numpy as np
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, UploadFile, Request, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Garden, Detection
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scan", tags=["scan"])
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/")
async def scan_image(
    request: Request,
    file: UploadFile = File(...),
    garden_id: str = Form(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        gid = int(garden_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail=f"garden_id không hợp lệ: {garden_id}")

    logger.info("Scan request: garden_id=%s, file=%s (%s), user=%s",
                gid, file.filename, file.content_type, user.id)

    garden = db.query(Garden).filter(Garden.id == gid, Garden.owner_id == user.id).first()
    if not garden:
        raise HTTPException(status_code=404, detail="Không tìm thấy vườn")

    # Read & decode image
    contents = await file.read()
    img_array = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh")

    # Save original image
    filename = f"{uuid.uuid4().hex}.jpg"
    save_path = UPLOAD_DIR / filename
    cv2.imwrite(str(save_path), img_bgr)

    # Run inference
    predictor = request.app.state.predictor
    results, analysis = predictor.predict(img_bgr)

    # Save detections to DB
    saved = []
    for det in results:
        record = Detection(
            garden_id=gid,
            user_id=user.id,
            image_path=filename,
            disease_label=det["label"],
            disease_label_vi=det["label_vi"],
            confidence=det["confidence"],
            bbox=json.dumps(det["bbox"]),
            top_k=json.dumps(det["top_k"]),
            center_x=det["center"][0],
            center_y=det["center"][1],
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        saved.append({
            "id": record.id,
            "garden_id": gid,
            "garden_name": garden.name,
            "image_url": f"/uploads/{filename}",
            "disease_label": det["label"],
            "disease_label_vi": det["label_vi"],
            "confidence": det["confidence"],
            "bbox": det["bbox"],
            "top_k": det["top_k"],
            "center_x": det["center"][0],
            "center_y": det["center"][1],
            "created_at": record.created_at.isoformat(),
        })

    # Update garden health score based on results
    if results:
        healthy_count = sum(1 for d in results if "healthy" in d["label"].lower())
        disease_ratio = 1 - (healthy_count / len(results))
        new_score = max(0, garden.health_score - int(disease_ratio * 5))
        garden.health_score = new_score
        db.commit()

    return {
        "image_url": f"/uploads/{filename}",
        "detections": saved,
        "total": len(saved),
        "analysis": analysis,
    }
