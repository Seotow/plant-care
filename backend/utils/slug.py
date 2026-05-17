"""Utilities for generating unique disease slugs from Vietnamese names."""
import unicodedata
import re


def _to_ascii(text: str) -> str:
    """Chuyển chuỗi tiếng Việt → ASCII slug component."""
    normalized = unicodedata.normalize("NFD", text)
    ascii_only = normalized.encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", ascii_only.lower()).strip("_")


def make_disease_slug(db, plant_vi: str, disease_vi: str) -> str:
    """Tạo slug duy nhất dạng 'ca_chua___dom_nau' từ tên tiếng Việt.

    Kiểm tra trùng trong DB, thêm hậu tố _2, _3, ... nếu cần.
    """
    from models import DiseaseClass

    plant_slug = _to_ascii(plant_vi.strip())
    disease_slug = _to_ascii(disease_vi.strip())
    base = f"{plant_slug}___{disease_slug}" if disease_slug else plant_slug

    slug, n = base, 1
    while db.query(DiseaseClass).filter(DiseaseClass.name == slug).first():
        n += 1
        slug = f"{base}_{n}"
    return slug
