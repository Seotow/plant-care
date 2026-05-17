import json
import uuid
import logging
import cv2
import numpy as np
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, UploadFile, Request, HTTPException
from sqlalchemy.orm import Session
import json as _json
from database import get_db
from models import User, Garden, Detection, DiseaseKnowledge
from auth import get_current_user


def _get_disease_info(db: Session, label: str) -> dict | None:
    """Tra cứu thông tin bệnh từ database."""
    row = db.query(DiseaseKnowledge).filter(DiseaseKnowledge.label == label).first()
    if not row:
        return None
    return {
        "mo_ta": row.mo_ta,
        "nguyen_nhan": row.nguyen_nhan,
        "xu_ly": _json.loads(row.xu_ly) if row.xu_ly else [],
    }

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

    # Run inference with Grad-CAM
    predictor = request.app.state.predictor
    results, analysis = predictor.predict(img_bgr, gradcam=True)

    # Save Grad-CAM heatmaps
    heatmap_dir = UPLOAD_DIR / "heatmaps"
    heatmap_dir.mkdir(exist_ok=True)
    for det in results:
        overlay = det.pop("gradcam_overlay", None)
        if overlay is not None:
            hm_name = f"{uuid.uuid4().hex}.jpg"
            cv2.imwrite(str(heatmap_dir / hm_name), overlay)
            det["heatmap_url"] = f"/uploads/heatmaps/{hm_name}"

    # Save detections to DB (batch commit)
    records = []
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
        records.append((record, det))

    db.commit()
    for record, _ in records:
        db.refresh(record)

    saved = []
    for record, det in records:
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
            "heatmap_url": det.get("heatmap_url"),
            "co_diseases": det.get("co_diseases", []),
            "disease_info": _get_disease_info(db, det["label"]),
            "created_at": record.created_at.isoformat(),
        })

    # Update garden health score based on results
    if results:
        healthy_count = sum(1 for d in results if "healthy" in d["label"].lower())
        disease_ratio = 1 - (healthy_count / len(results))
        # Giảm tối đa 10đ nếu toàn bệnh, phục hồi tối đa 5đ nếu toàn lành
        delta = int(disease_ratio * 10) - int((1 - disease_ratio) * 5)
        new_score = max(0, min(100, garden.health_score - delta))
        garden.health_score = new_score
        db.commit()

    return {
        "image_url": f"/uploads/{filename}",
        "image_width": img_bgr.shape[1],
        "image_height": img_bgr.shape[0],
        "detections": saved,
        "total": len(saved),
        "analysis": analysis,
    }


@router.post("/test-gradcam")
async def test_gradcam(
    request: Request,
    file: UploadFile = File(...),
    mode: str = Form("classifier"),
    user: User = Depends(get_current_user),
):
    """YOLO detect + Grad-CAM test — no DB write.

    mode=classifier: old 38-class SwinForImageClassification + Grad-CAM
    mode=embedding:  current SwinEmbedding + Grad-CAM (prototype-based)
    """
    contents = await file.read()
    img_bgr = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh")

    predictor = request.app.state.predictor
    H, W = img_bgr.shape[:2]

    filename = f"test_{uuid.uuid4().hex}.jpg"
    cv2.imwrite(str(UPLOAD_DIR / filename), img_bgr)

    yolo_results = predictor.yolo(img_bgr, conf=0.35, verbose=False)[0]

    heatmap_dir = UPLOAD_DIR / "heatmaps"
    heatmap_dir.mkdir(exist_ok=True)
    crop_dir = UPLOAD_DIR / "test_crops"
    crop_dir.mkdir(exist_ok=True)

    crops = []
    for box in yolo_results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        margin = 0.05
        px = int((x2 - x1) * margin)
        py = int((y2 - y1) * margin)
        crop_bgr = img_bgr[
            max(0, y1 - py): min(H, y2 + py),
            max(0, x1 - px): min(W, x2 + px),
        ]
        if crop_bgr.size == 0:
            continue

        crop_name = f"test_crop_{uuid.uuid4().hex}.jpg"
        cv2.imwrite(str(crop_dir / crop_name), crop_bgr)

        crop_data = {
            "bbox": [x1, y1, x2, y2],
            "crop_url": f"/uploads/test_crops/{crop_name}",
            "yolo_conf": round(float(box.conf), 4),
        }

        if mode == "classifier":
            result = predictor.classify_crop(crop_bgr)
            crop_data["predictions"] = result["predictions"]
            overlay = result["gradcam_overlay"]
        else:
            overlay = predictor.generate_gradcam(crop_bgr)
            crop_data["predictions"] = []

        if overlay is not None:
            hm_name = f"test_hm_{uuid.uuid4().hex}.jpg"
            cv2.imwrite(str(heatmap_dir / hm_name), overlay)
            crop_data["heatmap_url"] = f"/uploads/heatmaps/{hm_name}"

        crops.append(crop_data)

    return {
        "image_url": f"/uploads/{filename}",
        "crops": crops,
        "total": len(crops),
        "mode": mode,
    }
