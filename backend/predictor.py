"""Plant Disease Detection & Classification Pipeline
Two-stage: YOLO detect → Swin Transformer classify
"""
import os
import cv2
import torch
import numpy as np
from collections import Counter
from pathlib import Path
from PIL import Image
from ultralytics import YOLO
from transformers import SwinForImageClassification, SwinConfig
from torchvision import transforms

BASE_DIR = Path(__file__).resolve().parent.parent  # plant-care/
MODEL_DIR = Path(os.environ.get("MODEL_DIR", str(BASE_DIR / "models")))

LABEL_VI = {
    "Apple___Apple_scab": "Táo — Ghẻ táo",
    "Apple___Black_rot": "Táo — Thối đen",
    "Apple___Cedar_apple_rust": "Táo — Rỉ sắt tuyết tùng",
    "Apple___healthy": "Táo — Khỏe mạnh",
    "Blueberry___healthy": "Việt quất — Khỏe mạnh",
    "Cherry_(including_sour)___Powdery_mildew": "Anh đào — Phấn trắng",
    "Cherry_(including_sour)___healthy": "Anh đào — Khỏe mạnh",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Ngô — Đốm lá xám",
    "Corn_(maize)___Common_rust_": "Ngô — Rỉ sắt",
    "Corn_(maize)___Northern_Leaf_Blight": "Ngô — Cháy lá phía bắc",
    "Corn_(maize)___healthy": "Ngô — Khỏe mạnh",
    "Grape___Black_rot": "Nho — Thối đen",
    "Grape___Esca_(Black_Measles)": "Nho — Bệnh Esca",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Nho — Cháy lá",
    "Grape___healthy": "Nho — Khỏe mạnh",
    "Orange___Haunglongbing_(Citrus_greening)": "Cam — Vàng lá gân xanh",
    "Peach___Bacterial_spot": "Đào — Đốm vi khuẩn",
    "Peach___healthy": "Đào — Khỏe mạnh",
    "Pepper,_bell___Bacterial_spot": "Ớt chuông — Đốm vi khuẩn",
    "Pepper,_bell___healthy": "Ớt chuông — Khỏe mạnh",
    "Potato___Early_blight": "Khoai tây — Cháy sớm",
    "Potato___Late_blight": "Khoai tây — Mốc sương",
    "Potato___healthy": "Khoai tây — Khỏe mạnh",
    "Raspberry___healthy": "Mâm xôi — Khỏe mạnh",
    "Soybean___healthy": "Đậu nành — Khỏe mạnh",
    "Squash___Powdery_mildew": "Bí — Phấn trắng",
    "Strawberry___Leaf_scorch": "Dâu tây — Cháy lá",
    "Strawberry___healthy": "Dâu tây — Khỏe mạnh",
    "Tomato___Bacterial_spot": "Cà chua — Đốm vi khuẩn",
    "Tomato___Early_blight": "Cà chua — Cháy sớm",
    "Tomato___Late_blight": "Cà chua — Mốc sương",
    "Tomato___Leaf_Mold": "Cà chua — Mốc lá",
    "Tomato___Septoria_leaf_spot": "Cà chua — Đốm lá Septoria",
    "Tomato___Spider_mites Two-spotted_spider_mite": "Cà chua — Nhện đỏ hai chấm",
    "Tomato___Target_Spot": "Cà chua — Đốm vòng",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Cà chua — Virus xoăn vàng lá",
    "Tomato___Tomato_mosaic_virus": "Cà chua — Virus khảm",
    "Tomato___healthy": "Cà chua — Khỏe mạnh",
}


def _extract_species(label: str) -> str:
    """Extract plant species from a PlantVillage label, e.g. 'Tomato___Early_blight' -> 'Tomato'."""
    return label.split("___")[0].split(",")[0].strip()


class PlantDiseasePredictor:
    def __init__(
        self,
        yolo_weights: str = str(MODEL_DIR / "best.pt"),
        swin_weights: str = str(MODEL_DIR / "swin_classifier.pth"),
        device: str = "auto",
    ):
        self.device = (
            torch.device("cuda" if torch.cuda.is_available() else "cpu")
            if device == "auto"
            else torch.device(device)
        )

        # Stage 1: YOLO detector
        self.yolo = YOLO(yolo_weights)

        # Stage 2: Swin Transformer classifier
        ckpt = torch.load(swin_weights, map_location=self.device, weights_only=False)
        self.class_names = ckpt["class_names"]
        num_labels = ckpt.get("num_labels", len(self.class_names))

        config = SwinConfig(**ckpt["swin_config"])
        config.num_labels = num_labels
        config.id2label = {str(i): n for i, n in enumerate(self.class_names)}
        config.label2id = {n: i for i, n in enumerate(self.class_names)}

        self.swin = SwinForImageClassification(config)
        self.swin.load_state_dict(ckpt["model_state"])
        self.swin.to(self.device).eval()

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        print(f"[Predictor] YOLO: {Path(yolo_weights).name}")
        print(f"[Predictor] Swin: {Path(swin_weights).name} ({num_labels} classes)")
        print(f"[Predictor] Device: {self.device}")

    def _compute_iou(self, box_a, box_b):
        x1 = max(box_a[0], box_b[0])
        y1 = max(box_a[1], box_b[1])
        x2 = min(box_a[2], box_b[2])
        y2 = min(box_a[3], box_b[3])
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        area_a = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
        area_b = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
        union = area_a + area_b - intersection
        return intersection / union if union > 0 else 0

    def _apply_nms(self, detections, iou_threshold=0.5):
        if not detections:
            return detections
        ranked = sorted(detections, key=lambda d: d["yolo_conf"], reverse=True)
        kept = []
        while ranked:
            best = ranked.pop(0)
            kept.append(best)
            ranked = [
                d for d in ranked
                if self._compute_iou(best["bbox"], d["bbox"]) < iou_threshold
            ]
        return kept

    def _majority_vote_species(self, detections):
        """Enforce single plant species per image.

        Determines the dominant species by counting detections, then either
        re-classifies outliers (if their top-k contains a match for the
        dominant species above min_confidence) or drops them entirely.
        """
        if len(detections) < 2:
            return detections

        species_counts = Counter(_extract_species(d["label"]) for d in detections)
        dominant_species, _ = species_counts.most_common(1)[0]
        min_confidence = 0.03

        corrected = []
        for det in detections:
            if _extract_species(det["label"]) == dominant_species:
                corrected.append(det)
                continue

            # Search top-k for a label matching the dominant species
            replacement = None
            for name, conf in det["top_k"]:
                if _extract_species(name) == dominant_species and conf >= min_confidence:
                    replacement = (name, conf)
                    break

            if replacement:
                det["label"] = replacement[0]
                det["confidence"] = replacement[1]
                corrected.append(det)
            # else: drop — species không khớp và top-k không có thay thế

        return corrected

    def predict(self, img, conf: float = 0.35, cls_conf: float = 0.15, top_k: int = 3) -> tuple[list[dict], dict]:
        if isinstance(img, (str, Path)):
            img_bgr = cv2.imread(str(img))
        else:
            img_bgr = img
        if img_bgr is None:
            return [], {"total_leaves": 0, "healthy_leaves": 0, "diseased_leaves": 0, "disease_ratio": 0}

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        H, W = img_rgb.shape[:2]

        yolo_results = self.yolo(img_bgr, conf=conf, verbose=False)[0]
        detections = []

        for box in yolo_results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            margin = 0.05
            px = int((x2 - x1) * margin)
            py = int((y2 - y1) * margin)
            crop = img_rgb[
                max(0, y1 - py) : min(H, y2 + py),
                max(0, x1 - px) : min(W, x2 + px),
            ]
            if crop.size == 0:
                continue

            tensor = self.transform(Image.fromarray(crop)).unsqueeze(0).to(self.device)
            with torch.no_grad():
                probs = torch.softmax(
                    self.swin(pixel_values=tensor).logits, dim=1
                )[0].cpu().numpy()

            top_idx = np.argsort(probs)[::-1][:top_k]
            detections.append({
                "bbox": [x1, y1, x2, y2],
                "yolo_conf": float(box.conf),
                "label": self.class_names[top_idx[0]],
                "confidence": float(probs[top_idx[0]]),
                "top_k": [
                    (self.class_names[i], round(float(probs[i]), 4))
                    for i in top_idx
                ],
            })

        detections = self._apply_nms(detections)
        detections = self._majority_vote_species(detections)

        # Drop detections below classifier confidence threshold
        detections = [d for d in detections if d["confidence"] >= cls_conf]

        for det in detections:
            bx1, by1, bx2, by2 = det["bbox"]
            det["center"] = [
                round((bx1 + bx2) / 2 / W, 4),
                round((by1 + by2) / 2 / H, 4),
            ]
            det["label_vi"] = LABEL_VI.get(det["label"], det["label"])

        total = len(detections)
        healthy = sum(1 for d in detections if "healthy" in d["label"].lower())
        analysis = {
            "total_leaves": total,
            "healthy_leaves": healthy,
            "diseased_leaves": total - healthy,
            "disease_ratio": round((total - healthy) / total, 2) if total else 0,
        }

        return detections, analysis
