"""
Migration: Tạo DiseaseClass cho 38 bệnh gốc và cập nhật tên tiếng Việt.
Chạy: python migrate_disease_names_vi.py
"""

from database import SessionLocal
from models import DiseaseClass, DiseaseKnowledge

# Mapping: label -> (plant_name_vi, disease_name_vi)
BUILTIN_VI_NAMES = {
    "Apple___Apple_scab":                               ("Táo", "Ghẻ táo"),
    "Apple___Black_rot":                                ("Táo", "Thối đen"),
    "Apple___Cedar_apple_rust":                         ("Táo", "Gỉ sắt táo"),
    "Apple___healthy":                                  ("Táo", "Khỏe mạnh"),
    "Blueberry___healthy":                              ("Việt quất", "Khỏe mạnh"),
    "Cherry_(including_sour)___Powdery_mildew":         ("Anh đào", "Phấn trắng"),
    "Cherry_(including_sour)___healthy":                ("Anh đào", "Khỏe mạnh"),
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": ("Ngô", "Đốm lá Cercospora"),
    "Corn_(maize)___Common_rust_":                      ("Ngô", "Gỉ sắt thường"),
    "Corn_(maize)___Northern_Leaf_Blight":              ("Ngô", "Cháy lá phía bắc"),
    "Corn_(maize)___healthy":                           ("Ngô", "Khỏe mạnh"),
    "Grape___Black_rot":                                ("Nho", "Thối đen"),
    "Grape___Esca_(Black_Measles)":                     ("Nho", "Esca (Đốm đen)"),
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)":       ("Nho", "Cháy lá Isariopsis"),
    "Grape___healthy":                                  ("Nho", "Khỏe mạnh"),
    "Orange___Haunglongbing_(Citrus_greening)":         ("Cam", "Greening (Vàng lá gân xanh)"),
    "Peach___Bacterial_spot":                           ("Đào", "Đốm vi khuẩn"),
    "Peach___healthy":                                  ("Đào", "Khỏe mạnh"),
    "Pepper,_bell___Bacterial_spot":                    ("Ớt chuông", "Đốm vi khuẩn"),
    "Pepper,_bell___healthy":                           ("Ớt chuông", "Khỏe mạnh"),
    "Potato___Early_blight":                            ("Khoai tây", "Cháy sớm"),
    "Potato___Late_blight":                             ("Khoai tây", "Cháy muộn"),
    "Potato___healthy":                                 ("Khoai tây", "Khỏe mạnh"),
    "Raspberry___healthy":                              ("Mâm xôi", "Khỏe mạnh"),
    "Soybean___healthy":                                ("Đậu tương", "Khỏe mạnh"),
    "Squash___Powdery_mildew":                          ("Bí", "Phấn trắng"),
    "Strawberry___Leaf_scorch":                         ("Dâu tây", "Cháy lá"),
    "Strawberry___healthy":                             ("Dâu tây", "Khỏe mạnh"),
    "Tomato___Bacterial_spot":                          ("Cà chua", "Đốm vi khuẩn"),
    "Tomato___Early_blight":                            ("Cà chua", "Cháy sớm"),
    "Tomato___Late_blight":                             ("Cà chua", "Cháy muộn"),
    "Tomato___Leaf_Mold":                               ("Cà chua", "Mốc lá"),
    "Tomato___Septoria_leaf_spot":                      ("Cà chua", "Đốm Septoria"),
    "Tomato___Spider_mites Two-spotted_spider_mite":    ("Cà chua", "Nhện đỏ hai chấm"),
    "Tomato___Target_Spot":                             ("Cà chua", "Đốm mắt bò"),
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus":           ("Cà chua", "Virus xoăn vàng lá"),
    "Tomato___Tomato_mosaic_virus":                     ("Cà chua", "Virus khảm cà chua"),
    "Tomato___healthy":                                 ("Cà chua", "Khỏe mạnh"),
}


def run():
    db = SessionLocal()
    try:
        updated = 0
        created = 0
        for label, (plant_vi, disease_vi) in BUILTIN_VI_NAMES.items():
            name_vi = f"{plant_vi} - {disease_vi}" if disease_vi else plant_vi

            # Find or create DiseaseClass for this label
            disease_class = db.query(DiseaseClass).filter(DiseaseClass.name == label).first()
            if not disease_class:
                disease_class = DiseaseClass(
                    name=label,
                    name_vi=name_vi,
                    plant_name_vi=plant_vi,
                    disease_name_vi=disease_vi,
                    is_builtin=1,
                )
                db.add(disease_class)
                db.flush()
                created += 1
            else:
                disease_class.name_vi = name_vi
                disease_class.plant_name_vi = plant_vi
                disease_class.disease_name_vi = disease_vi
                disease_class.is_builtin = 1
                updated += 1

            # Link DiseaseKnowledge entry to this DiseaseClass
            kb = db.query(DiseaseKnowledge).filter(DiseaseKnowledge.label == label).first()
            if kb and kb.disease_class_id != disease_class.id:
                kb.disease_class_id = disease_class.id

        db.commit()
        print(f"Done: {created} DiseaseClass created, {updated} updated.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
