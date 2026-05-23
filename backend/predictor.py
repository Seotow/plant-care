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
from transformers import SwinModel, SwinConfig, SwinForImageClassification
from torchvision import transforms

BASE_DIR = Path(__file__).resolve().parent.parent  # plant-care/
MODEL_DIR = Path(os.environ.get("MODEL_DIR", str(BASE_DIR / "models")))

LABEL_VI = {
    "Apple___Apple_scab": "Táo - Ghẻ táo",
    "Apple___Black_rot": "Táo - Thối đen",
    "Apple___Cedar_apple_rust": "Táo - Rỉ sắt tuyết tùng",
    "Apple___healthy": "Táo - Khỏe mạnh",
    "Blueberry___healthy": "Việt quất - Khỏe mạnh",
    "Cherry_(including_sour)___Powdery_mildew": "Anh đào - Phấn trắng",
    "Cherry_(including_sour)___healthy": "Anh đào - Khỏe mạnh",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Ngô - Đốm lá xám",
    "Corn_(maize)___Common_rust_": "Ngô - Rỉ sắt",
    "Corn_(maize)___Northern_Leaf_Blight": "Ngô - Cháy lá phía bắc",
    "Corn_(maize)___healthy": "Ngô - Khỏe mạnh",
    "Grape___Black_rot": "Nho - Thối đen",
    "Grape___Esca_(Black_Measles)": "Nho - Bệnh Esca",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Nho - Cháy lá",
    "Grape___healthy": "Nho - Khỏe mạnh",
    "Orange___Haunglongbing_(Citrus_greening)": "Cam - Vàng lá gân xanh",
    "Peach___Bacterial_spot": "Đào - Đốm vi khuẩn",
    "Peach___healthy": "Đào - Khỏe mạnh",
    "Pepper,_bell___Bacterial_spot": "Ớt chuông - Đốm vi khuẩn",
    "Pepper,_bell___healthy": "Ớt chuông - Khỏe mạnh",
    "Potato___Early_blight": "Khoai tây - Cháy sớm",
    "Potato___Late_blight": "Khoai tây - Mốc sương",
    "Potato___healthy": "Khoai tây - Khỏe mạnh",
    "Raspberry___healthy": "Mâm xôi - Khỏe mạnh",
    "Soybean___healthy": "Đậu nành - Khỏe mạnh",
    "Squash___Powdery_mildew": "Bí - Phấn trắng",
    "Strawberry___Leaf_scorch": "Dâu tây - Cháy lá",
    "Strawberry___healthy": "Dâu tây - Khỏe mạnh",
    "Tomato___Bacterial_spot": "Cà chua - Đốm vi khuẩn",
    "Tomato___Early_blight": "Cà chua - Cháy sớm",
    "Tomato___Late_blight": "Cà chua - Mốc sương",
    "Tomato___Leaf_Mold": "Cà chua - Mốc lá",
    "Tomato___Septoria_leaf_spot": "Cà chua - Đốm lá Septoria",
    "Tomato___Spider_mites Two-spotted_spider_mite": "Cà chua - Nhện đỏ hai chấm",
    "Tomato___Target_Spot": "Cà chua - Đốm vòng",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Cà chua - Virus xoăn vàng lá",
    "Tomato___Tomato_mosaic_virus": "Cà chua - Virus khảm",
    "Tomato___healthy": "Cà chua - Khỏe mạnh",
}


def _extract_species(label: str) -> str:
    return label.split("___")[0].split(",")[0].strip()


def _gradcam_pp_from_seq(feat, grad) -> np.ndarray:
    """GradCAM++ weighting for Swin sequence-format features.

    feat, grad: tensors of shape (1, seq_len, C) on any device.
    Returns normalized float32 ndarray shaped (h, w) ready for cv2.resize.

    GradCAM++ improves over standard Grad-CAM by weighting each gradient
    value with a second-order coefficient alpha, which handles multiple
    activation peaks (e.g. several disease spots) better than simple mean.

    Reference: Chattopadhay et al., "Grad-CAM++", WACV 2018.
    """
    # ── GradCAM++ alpha weights ──
    # alpha_{k,j} = grad²_{k,j} / (2·grad²_{k,j} + Σ_i A_{k,i}·grad³_{k,i} + ε)
    grad2 = grad.pow(2)                                      # (1, seq_len, C)
    grad3 = grad.pow(3)                                      # (1, seq_len, C)
    global_sum = (feat * grad3).sum(dim=1, keepdim=True)     # (1, 1, C) sum over spatial
    alpha = grad2 / (2.0 * grad2 + global_sum + 1e-7)       # (1, seq_len, C)

    # Channel weights: Σ_j alpha_j · relu(grad_j)  - sum over spatial positions
    weights = (alpha * F.relu(grad)).sum(dim=1, keepdim=True)  # (1, 1, C)

    cam = (feat * weights).sum(dim=-1)  # (1, seq_len)
    cam = F.relu(cam)

    seq_len = cam.shape[1]
    h = w = int(seq_len ** 0.5)
    cam_np = cam.view(h, w).cpu().numpy().astype(np.float32)

    # Suppress background: discard activations below 75th percentile
    threshold = float(np.percentile(cam_np, 75))
    cam_np = np.maximum(cam_np - threshold, 0.0)

    cam_max = cam_np.max()
    if cam_max > 1e-8:
        cam_np = cam_np / cam_max
    return cam_np


def _layercam_from_seq(feat_list, grad_list) -> np.ndarray:
    """LayerCAM: pixel-level relu(grad) ⊙ feat, preserving spatial gradient info.

    Unlike Grad-CAM (spatially-averaged gradient → one weight per channel),
    LayerCAM uses per-position gradient × feature → detects multiple small
    disease spots scattered across the leaf.

    Fuses Stage 0 (56×56, fine) + Stage 1 (28×28, semantic) at full resolution.
    Stage 0 weighting 60% is critical - 4× more spatial detail than Stage 2.

    Reference: Jiang et al., 'LayerCAM: Exploring Hierarchical Class Activation
    Maps for Localization', IEEE TIP 2021.

    feat_list, grad_list: lists of (1, seq_len, C) tensors [stage0, stage1]
    Returns normalized float32 ndarray shaped (56, 56).
    """
    TARGET = 56  # upsample all stages to stage0 resolution
    cams = []
    stage_weights = [0.60, 0.40]  # stage0 (fine) vs stage1 (semantic)

    for feat, grad in zip(feat_list, grad_list):
        # LayerCAM: relu(grad) ⊙ feat - preserves per-position gradient
        cam = F.relu(grad) * feat        # (1, seq_len, C)
        cam = cam.sum(dim=-1)            # (1, seq_len)
        cam = F.relu(cam)

        seq_len = cam.shape[1]
        h = w = int(seq_len ** 0.5)
        cam_np = cam.squeeze(0).cpu().numpy().astype(np.float32).reshape(h, w)

        cam_max = cam_np.max()
        if cam_max > 1e-8:
            cam_np /= cam_max

        cam_np = cv2.resize(cam_np, (TARGET, TARGET), interpolation=cv2.INTER_LANCZOS4)
        cams.append(cam_np)

    if not cams:
        return np.zeros((TARGET, TARGET), dtype=np.float32)

    weights = stage_weights[:len(cams)]
    fused = sum(w * c for w, c in zip(weights, cams))

    fused_max = fused.max()
    if fused_max > 1e-8:
        fused /= fused_max
    return fused


def _leaf_foreground_mask(img_bgr: np.ndarray) -> np.ndarray:
    """Soft foreground mask that keeps only the leaf region inside a YOLO crop.

    Strategy:
      1. HSV thresholding to exclude near-black / near-white backgrounds
      2. Keep only the largest connected component (= the leaf)
      3. Morphological hole-filling to close dark spots inside leaf
      4. Gaussian blur for smooth edge transition

    This prevents LayerCAM activations and color anomaly from bleeding into
    the background padding added by the 5% YOLO crop margin.

    Returns float32 [0,1], same spatial size as img_bgr.
    """
    H, W = img_bgr.shape[:2]
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    V_ch = hsv[:, :, 2].astype(np.float32)
    S_ch = hsv[:, :, 1].astype(np.float32)

    # Broad mask: exclude near-black and near-white/grey uniform backgrounds
    raw = ((V_ch > 18) & (V_ch < 250) & (S_ch > 8)).astype(np.uint8)

    # Keep the largest connected component - this should be the leaf
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(raw, connectivity=8)
    if n_labels > 1:
        # stats[0] = background; find largest non-background component
        areas = stats[1:, cv2.CC_STAT_AREA]
        largest_idx = int(np.argmax(areas)) + 1
        mask = (labels == largest_idx).astype(np.uint8)
    else:
        mask = raw

    # Close holes (disease spots that happen to be very dark = disconnected)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=3)

    # Soft edge so the mask boundary doesn't create hard heatmap artifacts
    sigma = max(W, H) / 35.0
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigmaX=sigma)
    return np.clip(soft, 0.0, 1.0)


def _color_anomaly_map(img_bgr: np.ndarray) -> tuple:
    """Detect visually anomalous leaf regions (disease spots) via color analysis.

    Directly detects pixels with disease-typical colors in HSV space:
      - Brown / necrotic lesions (H 0-20° or 155-179°)
      - Dark necrosis - ADAPTIVE threshold based on median leaf brightness
        (avoids flagging the whole leaf when it is naturally dark-colored)
      - Yellow patches (H 20-38°, S > 50, V > 80)
      - White powder / mildew (V > 210, S < 40)
      - Rust / orange spots (H 5-22°, S > 75)

    Followed by morphological cleanup (open → close → dilate) and Gaussian
    smoothing for soft spot boundaries.

    Returns (anomaly_map, leaf_mask) - both float32 [0, 1] same size as img_bgr.
    """
    H_img, W_img = img_bgr.shape[:2]

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    H_ch = hsv[:, :, 0]   # 0-179 in OpenCV
    S_ch = hsv[:, :, 1]   # 0-255
    V_ch = hsv[:, :, 2]   # 0-255

    # Leaf mask: exclude pure background (very dark or overexposed)
    leaf_mask = ((V_ch > 20) & (V_ch < 252) & (S_ch > 12)).astype(np.float32)

    # ── Adaptive dark-necrosis threshold ──
    # Problem: dark-leaved plants (e.g. basil, purple kale) have median V < 80.
    # A fixed V<72 threshold flags the ENTIRE leaf as diseased.
    # Fix: use relative threshold = 55% of leaf median V; min 30, max 72.
    # For bright leaves (median V > 80) the threshold stays at 72 as before.
    leaf_pix = V_ch[leaf_mask > 0]
    leaf_v_median = float(np.median(leaf_pix)) if len(leaf_pix) > 200 else 128.0
    dark_v_thresh = float(np.clip(leaf_v_median * 0.55, 30.0, 72.0))
    # Also scale dark weight: full weight for bright leaves, reduced for dark
    dark_weight = float(np.clip(0.85 * (leaf_v_median / 90.0), 0.15, 0.85))

    # Healthy green: H=35–85, S>35, V>35
    healthy = (
        (H_ch >= 35) & (H_ch <= 85) &
        (S_ch >= 35) & (V_ch >= 35)
    ).astype(np.float32)

    # Brown / necrotic
    brown = (
        ((H_ch <= 20) | (H_ch >= 155)) &
        (S_ch >= 30) & (S_ch <= 210) &
        (V_ch >= 25) & (V_ch <= 185)
    ).astype(np.float32)

    # Yellow lesion
    yellow = (
        (H_ch >= 20) & (H_ch <= 38) &
        (S_ch >= 50) & (V_ch >= 80)
    ).astype(np.float32)

    # Dark necrosis (adaptive threshold, not pure shadow)
    dark = ((V_ch >= 15) & (V_ch < dark_v_thresh) & (S_ch >= 15)).astype(np.float32)

    # White powder / mildew
    white_powder = (
        (V_ch > 210) & (S_ch < 40) & (leaf_mask > 0)
    ).astype(np.float32)

    # Rust / orange
    rust = ((H_ch >= 5) & (H_ch <= 22) & (S_ch >= 75)).astype(np.float32)

    anomaly = (
        brown * 1.0 +
        yellow * 0.9 +
        dark * dark_weight +
        white_powder * 0.8 +
        rust * 1.0 +
        leaf_mask * (1.0 - healthy) * 0.30   # generic non-green
    )
    anomaly = np.clip(anomaly, 0.0, 1.0) * leaf_mask

    # Morphological cleanup
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    k5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    u8 = (anomaly * 255).astype(np.uint8)
    u8 = cv2.morphologyEx(u8, cv2.MORPH_OPEN, k3, iterations=1)   # remove noise
    u8 = cv2.morphologyEx(u8, cv2.MORPH_CLOSE, k5, iterations=1)  # bridge gaps
    u8 = cv2.dilate(u8, k3, iterations=1)                          # slight expansion
    anomaly = u8.astype(np.float32) / 255.0

    sigma = max(H_img, W_img) / 50.0
    anomaly = cv2.GaussianBlur(anomaly, (0, 0), sigmaX=sigma)

    amax = anomaly.max()
    if amax > 1e-8:
        anomaly /= amax
    return anomaly, leaf_mask


def _build_overlay(img_bgr: np.ndarray, cam_np: np.ndarray, label: str = "") -> np.ndarray:
    """Upsample semantic CAM, fuse with color anomaly, constrain to leaf region.

    Pipeline:
      1. Upsample CAM to full image size (LANCZOS4)
      2. Compute _leaf_foreground_mask → zero CAM outside the actual leaf
         (prevents LayerCAM activations in the 5% background padding)
      3. Compute color anomaly map (adaptive HSV - handles dark-leaved plants)
      4. Fusion:
           - color_mean > 0.05: geometric mean (both signals must agree)
           - else: trust CAM only (subtle disease, no strong color change)
      5. Percentile threshold → smooth → JET overlay
    """
    H, W = img_bgr.shape[:2]

    cam_resized = cv2.resize(cam_np, (W, H), interpolation=cv2.INTER_LANCZOS4)
    cam_resized = np.clip(cam_resized, 0.0, 1.0)

    # ── Step 0: Edge suppression - zero out 12% border to exclude hands/foreign objects ──
    # Cosine ramp: full activation at 12% inward, fades to 0 at the pixel edge
    BORDER = 0.12
    ys = np.linspace(0.0, 1.0, H, dtype=np.float32)
    xs = np.linspace(0.0, 1.0, W, dtype=np.float32)
    ry = np.clip(np.minimum(ys, 1.0 - ys) / BORDER, 0.0, 1.0)
    rx = np.clip(np.minimum(xs, 1.0 - xs) / BORDER, 0.0, 1.0)
    edge_mask = (0.5 - 0.5 * np.cos(np.pi * np.outer(ry, rx))).astype(np.float32)
    # outer product gives a hard corner - smooth it with the minimum
    ry2d = ry[:, np.newaxis] * np.ones((1, W), dtype=np.float32)
    rx2d = np.ones((H, 1), dtype=np.float32) * rx[np.newaxis, :]
    rmin = np.minimum(ry2d, rx2d)
    edge_mask = (0.5 - 0.5 * np.cos(np.pi * rmin)).astype(np.float32)
    cam_resized = cam_resized * edge_mask

    # ── Step 1: Hard leaf mask - zero out background pixels ──
    fg_mask = _leaf_foreground_mask(img_bgr)
    cam_resized = cam_resized * fg_mask

    # ── Step 2: Color anomaly (returns anomaly + leaf_mask) ──
    color_anomaly, _ = _color_anomaly_map(img_bgr)
    color_anomaly = color_anomaly * fg_mask   # also constrain to leaf
    color_mean = float(color_anomaly.mean())

    if color_mean > 0.05:
        # Geometric mean: requires both semantic AND color signal
        geo = np.sqrt(np.clip(cam_resized * color_anomaly, 0.0, 1.0))
        fused = 0.70 * geo + 0.30 * cam_resized
    else:
        fused = cam_resized

    # ── Step 3: Normalize + percentile threshold ──
    fmax = fused.max()
    if fmax > 1e-8:
        fused /= fmax

    thr = float(np.percentile(fused[fg_mask > 0.3], 60)) if fg_mask.sum() > 100 else float(np.percentile(fused, 60))
    fused = np.maximum(fused - thr, 0.0)
    fmax2 = fused.max()
    if fmax2 > 1e-8:
        fused /= fmax2

    fused = cv2.GaussianBlur(fused, (0, 0), sigmaX=max(W, H) / 70)
    fused = np.clip(fused, 0.0, 1.0)

    heatmap = cv2.applyColorMap(np.uint8(255 * fused), cv2.COLORMAP_JET)
    return cv2.addWeighted(img_bgr, 0.50, heatmap, 0.50, 0)


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
        """Generate heatmap overlay for a crop image.

        Strategy (best spatial accuracy first):
        1. LayerCAM on classifier (swin_classifier.pth) at Stage 0 (56×56) +
           Stage 1 (28×28) fused - highest resolution, class-aware gradients,
           combined with color-anomaly detection (HSV).
        2. LayerCAM on embedding model - fallback when classifier not available.

        Returns BGR overlay image, or None on failure.
        """
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        tensor = self.transform(pil_img).unsqueeze(0).to(self.device)

        label = ""
        if target_class_idx is not None and target_class_idx < len(self.all_class_names):
            label = self.all_class_names[target_class_idx]

        # ── Strategy 1: LayerCAM on classifier ──
        clf_path = MODEL_DIR / "swin_classifier.pth"
        if clf_path.exists():
            try:
                self._load_classifier()
                if label and label in self._clf_class_names:
                    clf_idx = self._clf_class_names.index(label)
                else:
                    with torch.no_grad():
                        clf_idx = int(
                            self._classifier(pixel_values=tensor.clone()).logits[0].argmax()
                        )
                return self._classifier_layercam(img_bgr, tensor, clf_idx, label)
            except Exception as e:
                print(f"[Grad-CAM] Classifier LayerCAM failed ({e}), falling back")

        # ── Strategy 2: LayerCAM on embedding model ──
        return self._embedding_layercam(img_bgr, tensor, label)

    def _classifier_layercam(self, img_bgr, tensor, target_class_idx, label=""):
        """LayerCAM on the 38-class classifier.

        Hooks Stage 0 (56×56, 96ch) and Stage 1 (28×28, 192ch) with both forward
        and backward hooks. Computes LayerCAM = relu(grad) ⊙ feat per stage,
        upsamples all to 56×56, fuses, then overlays with color anomaly detection.

        Why Stage 0+1 vs Stage 2:
          Stage 0 = 56×56 tokens → each token covers 4×4 px in original 224px image
          Stage 2 = 14×14 tokens → each token covers 16×16 px → too coarse for spots
        """
        s0_feat, s0_grad = {}, {}
        s1_feat, s1_grad = {}, {}

        def _fwd(store):
            def fn(m, i, o):
                store["val"] = (o[0] if isinstance(o, tuple) else o).detach().clone()
            return fn

        def _bwd(store):
            def fn(m, gi, go):
                if go[0] is not None:
                    store["val"] = go[0].detach().clone()
            return fn

        encoder = self._classifier.swin.encoder
        hooks = [
            encoder.layers[0].blocks[-1].register_forward_hook(_fwd(s0_feat)),
            encoder.layers[1].blocks[-1].register_forward_hook(_fwd(s1_feat)),
            encoder.layers[0].blocks[-1].register_full_backward_hook(_bwd(s0_grad)),
            encoder.layers[1].blocks[-1].register_full_backward_hook(_bwd(s1_grad)),
        ]

        try:
            t = tensor.detach().clone().requires_grad_(True)
            logits = self._classifier(pixel_values=t).logits
            score = logits[0, target_class_idx]
            self._classifier.zero_grad()
            score.backward()

            feat_list, grad_list = [], []
            for fs, gs in [(s0_feat, s0_grad), (s1_feat, s1_grad)]:
                if "val" in fs and "val" in gs:
                    feat_list.append(fs["val"])
                    grad_list.append(gs["val"])

            if not feat_list:
                raise ValueError("No features captured")

            cam_np = _layercam_from_seq(feat_list, grad_list)
            return _build_overlay(img_bgr, cam_np, label)
        except Exception as e:
            print(f"[LayerCAM Classifier] {e} - GradCAM++ fallback")
            try:
                return self._classifier_gradcam(img_bgr, tensor, target_class_idx)
            except Exception:
                return None
        finally:
            for h in hooks:
                h.remove()

    def _embedding_layercam(self, img_bgr, tensor, label="") -> np.ndarray:
        """LayerCAM on SwinEmbedding - hooks Stage 0 + Stage 1."""
        s0_feat, s0_grad = {}, {}
        s1_feat, s1_grad = {}, {}

        def _fwd(store):
            def fn(m, i, o):
                store["val"] = (o[0] if isinstance(o, tuple) else o).detach().clone()
            return fn

        def _bwd(store):
            def fn(m, gi, go):
                if go[0] is not None:
                    store["val"] = go[0].detach().clone()
            return fn

        encoder = self.swin.backbone.encoder
        hooks = [
            encoder.layers[0].blocks[-1].register_forward_hook(_fwd(s0_feat)),
            encoder.layers[1].blocks[-1].register_forward_hook(_fwd(s1_feat)),
            encoder.layers[0].blocks[-1].register_full_backward_hook(_bwd(s0_grad)),
            encoder.layers[1].blocks[-1].register_full_backward_hook(_bwd(s1_grad)),
        ]

        try:
            t = tensor.detach().clone().requires_grad_(True)
            emb = self.swin(pixel_values=t)
            sims = emb.detach().cpu().numpy() @ self.all_prototypes.T
            best_idx = int(sims.argmax())
            proto = torch.tensor(
                self.all_prototypes[best_idx], device=self.device, dtype=emb.dtype
            ).unsqueeze(0)
            score = (emb * proto).sum()
            self.swin.zero_grad()
            score.backward()

            feat_list, grad_list = [], []
            for fs, gs in [(s0_feat, s0_grad), (s1_feat, s1_grad)]:
                if "val" in fs and "val" in gs:
                    feat_list.append(fs["val"])
                    grad_list.append(gs["val"])

            if not feat_list:
                raise ValueError("No features captured")

            cam_np = _layercam_from_seq(feat_list, grad_list)
            return _build_overlay(img_bgr, cam_np, label)
        except Exception as e:
            print(f"[LayerCAM Embedding] {e}")
            return None
        finally:
            for h in hooks:
                h.remove()

    def _embedding_gradcam_pp(self, img_bgr, tensor, target_class_idx=None) -> np.ndarray:
        """GradCAM++ on SwinEmbedding - hooks stage2 last block (14×14). Kept as fallback."""
        features_store = {}
        gradients_store = {}

        def save_features(module, input, output):
            features_store["val"] = output[0] if isinstance(output, tuple) else output

        def save_gradients(module, grad_input, grad_output):
            gradients_store["val"] = grad_output[0]

        target_layer = self.swin.backbone.encoder.layers[2].blocks[-1]
        hook_fwd = target_layer.register_forward_hook(save_features)
        hook_bwd = target_layer.register_full_backward_hook(save_gradients)

        try:
            self.swin.eval()
            t = tensor.detach().clone().requires_grad_(True)
            emb = self.swin(pixel_values=t)

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

            feat = features_store["val"].detach()   # (1, seq_len, C)
            grad = gradients_store["val"].detach()   # (1, seq_len, C)

            cam_np = _gradcam_pp_from_seq(feat, grad)
            return _build_overlay(img_bgr, cam_np)
        except Exception as e:
            print(f"[Grad-CAM Embedding] Error: {e}")
            return None
        finally:
            hook_fwd.remove()
            hook_bwd.remove()

    # ── Old Swin Classifier (38-class, lazy-loaded) ──

    def _load_classifier(self):
        """Load swin_classifier.pth on first use - fully offline, no HF Hub calls."""
        if hasattr(self, "_classifier"):
            return
        clf_path = MODEL_DIR / "swin_classifier.pth"
        if not clf_path.exists():
            raise FileNotFoundError(f"Classifier not found: {clf_path}")

        ckpt = torch.load(str(clf_path), map_location=self.device, weights_only=False)
        self._clf_class_names = ckpt["class_names"]
        num_labels = ckpt.get("num_labels", len(self._clf_class_names))

        # Load từ config local - không cần internet
        local_config_dir = MODEL_DIR / "swin_config_local"
        if local_config_dir.exists():
            config = SwinConfig.from_pretrained(str(local_config_dir))
        else:
            # Fallback: tạo config tối thiểu cho Swin-Small
            config = SwinConfig(
                image_size=224, patch_size=4, num_channels=3,
                embed_dim=96, depths=[2, 2, 18, 2], num_heads=[3, 6, 12, 24],
                window_size=7, mlp_ratio=4.0, hidden_dropout_prob=0.0,
                attention_probs_dropout_prob=0.0,
            )
        config.num_labels = num_labels
        config.id2label = {i: name for i, name in enumerate(self._clf_class_names)}
        config.label2id = {name: i for i, name in enumerate(self._clf_class_names)}

        self._classifier = SwinForImageClassification(config)
        self._classifier.load_state_dict(ckpt["model_state"])
        self._classifier.to(self.device).eval()
        print(f"[Predictor] Classifier loaded (offline): {num_labels} classes, epoch {ckpt.get('epoch')}")

    def classify_crop(self, img_bgr, top_k=3):
        """Classify a crop using the old 38-class SwinForImageClassification.

        Returns dict with top_k predictions and Grad-CAM overlay.
        """
        self._load_classifier()
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        tensor = self.transform(pil_img).unsqueeze(0).to(self.device)

        # Forward pass
        with torch.no_grad():
            logits = self._classifier(pixel_values=tensor).logits[0]
        probs = torch.softmax(logits, dim=0).cpu().numpy()
        top_idx = np.argsort(-probs)[:top_k]
        predictions = [
            {"label": self._clf_class_names[i], "prob": round(float(probs[i]), 4)}
            for i in top_idx
        ]

        # Grad-CAM from classification logit
        overlay = self._classifier_gradcam(img_bgr, tensor, int(top_idx[0]))

        return {"predictions": predictions, "gradcam_overlay": overlay}

    def _classifier_gradcam(self, img_bgr, tensor, target_class_idx):
        """GradCAM++ on the 38-class classifier - hooks stage2 last block."""
        features_store = {}
        gradients_store = {}

        def save_features(module, input, output):
            features_store["val"] = output[0] if isinstance(output, tuple) else output

        def save_gradients(module, grad_input, grad_output):
            gradients_store["val"] = grad_output[0]

        target_layer = self._classifier.swin.encoder.layers[2].blocks[-1]
        hook_fwd = target_layer.register_forward_hook(save_features)
        hook_bwd = target_layer.register_full_backward_hook(save_gradients)

        try:
            t = tensor.detach().clone().requires_grad_(True)
            logits = self._classifier(pixel_values=t).logits
            score = logits[0, target_class_idx]
            self._classifier.zero_grad()
            score.backward()

            feat = features_store["val"].detach()   # (1, seq_len, C)
            grad = gradients_store["val"].detach()   # (1, seq_len, C)

            cam_np = _gradcam_pp_from_seq(feat, grad)
            return _build_overlay(img_bgr, cam_np)
        except Exception as e:
            print(f"[Classifier Grad-CAM] Error: {e}")
            return None
        finally:
            hook_fwd.remove()
            hook_bwd.remove()

    def _classify_embedding(self, embedding, top_k=3):
        if len(self.all_prototypes) == 0:
            return "unknown", 0.0, [], []

        similarities = embedding @ self.all_prototypes.T
        n_builtin = len(self.builtin_class_names)
        n_dynamic = len(self.dynamic_class_names)

        # Decide which prototype pool to rank from
        CUSTOM_MARGIN = 0.12
        if n_dynamic > 0:
            builtin_sims = similarities[:n_builtin]
            dynamic_sims = similarities[n_builtin:]
            best_builtin = float(builtin_sims.max())
            best_dynamic = float(dynamic_sims.max())

            if best_dynamic < best_builtin + CUSTOM_MARGIN:
                effective_sims = builtin_sims
                effective_names = self.builtin_class_names
            else:
                effective_sims = similarities
                effective_names = self.all_class_names
        else:
            effective_sims = similarities
            effective_names = self.all_class_names

        top_indices = np.argsort(-effective_sims)[:top_k]
        top_results = [
            (effective_names[i], round(float(effective_sims[i]), 4))
            for i in top_indices
        ]

        top_label, top_sim = top_results[0]
        top_species = _extract_species(top_label)

        # Co-disease detection: same species, different disease, within 85% of top-1 similarity.
        # Signals that the crop embedding lies between two disease clusters - likely co-infection.
        CO_DISEASE_RATIO = 0.85
        co_diseases = []
        if "healthy" not in top_label.lower() and top_sim > 0:
            for i, name in enumerate(effective_names):
                sim = float(effective_sims[i])
                if (
                    name != top_label
                    and _extract_species(name) == top_species
                    and "healthy" not in name.lower()
                    and sim >= top_sim * CO_DISEASE_RATIO
                    and sim > 0.20
                ):
                    co_diseases.append((name, round(sim, 4)))

        return top_label, top_sim, top_results, co_diseases

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
            label, confidence, top_results, co_diseases = self._classify_embedding(embedding, top_k)

            det = {
                "bbox": [x1, y1, x2, y2],
                "yolo_conf": float(box.conf),
                "label": label,
                "confidence": confidence,
                "top_k": top_results,
                "co_diseases": [
                    {
                        "label": name,
                        "label_vi": self.dynamic_labels_vi.get(name) or LABEL_VI.get(name, name),
                        "confidence": conf,
                    }
                    for name, conf in co_diseases
                ],
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
            # Update co_disease label_vi for dynamic labels (already set for builtin above)
            for cd in det["co_diseases"]:
                cd["label_vi"] = (
                    self.dynamic_labels_vi.get(cd["label"])
                    or LABEL_VI.get(cd["label"], cd["label"])
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
