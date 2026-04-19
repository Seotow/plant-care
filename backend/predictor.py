"""Plant Disease Detection & Classification Pipeline
Two-stage: YOLO detect → Swin Embedding → Cosine Similarity classify
Supports dynamic disease classes via prototype database.
"""
import os
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from collections import Counter
from pathlib import Path
from PIL import Image
from ultralytics import YOLO
from transformers import SwinModel, SwinConfig
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
    return label.split("___")[0].split(",")[0].strip()


class SwinEmbedding(nn.Module):
    """Swin backbone → projection → L2-normalized embedding."""

    def __init__(self, config, embed_dim=128, dropout=0.0):
        super().__init__()
        self.backbone = SwinModel(config)
        backbone_dim = config.hidden_size
        self.projection = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(backbone_dim, embed_dim),
            nn.BatchNorm1d(embed_dim),
        )

    def forward(self, pixel_values):
        outputs = self.backbone(pixel_values=pixel_values)
        pooled = outputs.pooler_output
        emb = self.projection(pooled)
        return F.normalize(emb, p=2, dim=1)


class PlantDiseasePredictor:
    def __init__(
        self,
        yolo_weights: str = str(MODEL_DIR / "best.pt"),
        swin_weights: str = str(MODEL_DIR / "swin_embedding.pth"),
        proto_path: str = str(MODEL_DIR / "prototypes.npz"),
        device: str = "auto",
    ):
        self.device = (
            torch.device("cuda" if torch.cuda.is_available() else "cpu")
            if device == "auto"
            else torch.device(device)
        )

        # Stage 1: YOLO detector
        self.yolo = YOLO(yolo_weights)

        # Stage 2: Swin embedding model
        ckpt = torch.load(swin_weights, map_location=self.device, weights_only=False)
        self.embed_dim = ckpt.get("embed_dim", 768)

        config = SwinConfig(**ckpt["swin_config"])
        self.swin = SwinEmbedding(config, embed_dim=self.embed_dim)
        self.swin.load_state_dict(ckpt["embed_model_state"])
        self.swin.to(self.device).eval()

        # Load prototypes (builtin from .npz file)
        proto_data = np.load(proto_path, allow_pickle=True)
        self.builtin_prototypes = proto_data["prototypes"].astype(np.float32)
        self.builtin_class_names = list(proto_data["class_names"])

        # Dynamic prototypes (loaded from DB at runtime)
        self.dynamic_prototypes = np.empty((0, self.embed_dim), dtype=np.float32)
        self.dynamic_class_names = []
        self.dynamic_labels_vi = {}

        self._rebuild_search_index()

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        print(f"[Predictor] YOLO: {Path(yolo_weights).name}")
        print(f"[Predictor] Swin Embedding: dim={self.embed_dim}")
        print(f"[Predictor] Builtin classes: {len(self.builtin_class_names)}")
        print(f"[Predictor] Device: {self.device}")

    def _rebuild_search_index(self):
        parts = [self.builtin_prototypes]
        names = list(self.builtin_class_names)
        if len(self.dynamic_prototypes) > 0:
            parts.append(self.dynamic_prototypes)
            names.extend(self.dynamic_class_names)
        self.all_prototypes = np.concatenate(parts, axis=0)
        self.all_class_names = names

    def reload_prototypes(self, db):
        from models import DiseaseClass
        custom_diseases = (
            db.query(DiseaseClass)
            .filter(DiseaseClass.is_builtin == 0)
            .all()
        )
        embs, names, labels_vi = [], [], {}
        for disease in custom_diseases:
            if disease.prototype and disease.prototype.embedding:
                emb = np.frombuffer(disease.prototype.embedding, dtype=np.float32).copy()
                if len(emb) == self.embed_dim:
                    embs.append(emb)
                    names.append(disease.name)
                    labels_vi[disease.name] = disease.name_vi or disease.name

        self.dynamic_prototypes = np.array(embs, dtype=np.float32) if embs else np.empty((0, self.embed_dim))
        self.dynamic_class_names = names
        self.dynamic_labels_vi = labels_vi
        self._rebuild_search_index()
        print(f"[Predictor] Reloaded {len(names)} custom disease(s)")

    def compute_embedding(self, img_bgr) -> np.ndarray:
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        tensor = self.transform(pil_img).unsqueeze(0).to(self.device)
        with torch.no_grad():
            embedding = self.swin(pixel_values=tensor)[0].cpu().numpy()
        return embedding.astype(np.float32)

    def generate_gradcam(self, img_bgr, target_class_idx=None) -> np.ndarray:
        """Generate Grad-CAM heatmap overlay for a crop image.

        Returns BGR image with heatmap overlay, or None on failure.
        """
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        tensor = self.transform(pil_img).unsqueeze(0).to(self.device)

        features_store = {}
        gradients_store = {}

        def save_features(module, input, output):
            features_store["val"] = output

        def save_gradients(module, grad_input, grad_output):
            gradients_store["val"] = grad_output[0]

        hook_fwd = self.swin.backbone.layernorm.register_forward_hook(save_features)
        hook_bwd = self.swin.backbone.layernorm.register_full_backward_hook(save_gradients)

        try:
            self.swin.eval()
            tensor.requires_grad_(True)

            emb = self.swin(pixel_values=tensor)

            if target_class_idx is None:
                sims = emb.detach().cpu().numpy() @ self.all_prototypes.T
                target_class_idx = int(sims.argmax())

            proto = torch.tensor(
                self.all_prototypes[target_class_idx],
                device=self.device, dtype=emb.dtype,
            ).unsqueeze(0)
            score = (emb * proto).sum()

            self.swin.zero_grad()
            score.backward()

            feat = features_store["val"].detach()     # (1, seq_len, C)
            grad = gradients_store["val"].detach()     # (1, seq_len, C)

            weights = grad.mean(dim=1, keepdim=True)   # (1, 1, C)
            cam = (feat * weights).sum(dim=-1)          # (1, seq_len)
            cam = F.relu(cam)

            seq_len = cam.shape[1]
            h = w = int(seq_len ** 0.5)
            cam = cam.view(h, w).cpu().numpy()
            cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

            cam_resized = cv2.resize(cam, (img_bgr.shape[1], img_bgr.shape[0]))
            heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
            overlay = cv2.addWeighted(img_bgr, 0.6, heatmap, 0.4, 0)
            return overlay
        except Exception as e:
            print(f"[Grad-CAM] Error: {e}")
            return None
        finally:
            hook_fwd.remove()
            hook_bwd.remove()

    def _classify_embedding(self, embedding, top_k=3):
        if len(self.all_prototypes) == 0:
            return "unknown", 0.0, []
        similarities = embedding @ self.all_prototypes.T
        top_indices = np.argsort(-similarities)[:top_k]
        top_results = [
            (self.all_class_names[i], round(float(similarities[i]), 4))
            for i in top_indices
        ]
        return top_results[0][0], top_results[0][1], top_results

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

            replacement = None
            for name, conf in det["top_k"]:
                if _extract_species(name) == dominant_species and conf >= min_confidence:
                    replacement = (name, conf)
                    break

            if replacement:
                det["label"] = replacement[0]
                det["confidence"] = replacement[1]
                corrected.append(det)

        return corrected

    def predict(self, img, conf: float = 0.35, cls_conf: float = 0.15, top_k: int = 3, gradcam: bool = False) -> tuple[list[dict], dict]:
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
                max(0, y1 - py): min(H, y2 + py),
                max(0, x1 - px): min(W, x2 + px),
            ]
            if crop.size == 0:
                continue

            crop_bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)
            embedding = self.compute_embedding(crop_bgr)
            label, confidence, top_results = self._classify_embedding(embedding, top_k)

            det = {
                "bbox": [x1, y1, x2, y2],
                "yolo_conf": float(box.conf),
                "label": label,
                "confidence": confidence,
                "top_k": top_results,
            }

            if gradcam:
                target_idx = self.all_class_names.index(label) if label in self.all_class_names else None
                det["gradcam_overlay"] = self.generate_gradcam(crop_bgr, target_idx)

            detections.append(det)

        detections = self._apply_nms(detections)
        detections = self._majority_vote_species(detections)
        detections = [d for d in detections if d["confidence"] >= cls_conf]

        for det in detections:
            bx1, by1, bx2, by2 = det["bbox"]
            det["center"] = [
                round((bx1 + bx2) / 2 / W, 4),
                round((by1 + by2) / 2 / H, 4),
            ]
            det["label_vi"] = (
                self.dynamic_labels_vi.get(det["label"])
                or LABEL_VI.get(det["label"], det["label"])
            )

        total = len(detections)
        healthy = sum(1 for d in detections if "healthy" in d["label"].lower())
        analysis = {
            "total_leaves": total,
            "healthy_leaves": healthy,
            "diseased_leaves": total - healthy,
            "disease_ratio": round((total - healthy) / total, 2) if total else 0,
        }

        return detections, analysis
