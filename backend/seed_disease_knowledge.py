"""
seed_disease_knowledge.py
=========================
Script chạy MỘT LẦN: import toàn bộ knowledge base bệnh cây từ
disease_knowledge.py vào bảng disease_knowledge trong SQLite.

Sau khi chạy thành công, có thể xóa file disease_knowledge.py vì
dữ liệu đã được lưu trong DB.

Usage:
    cd plant-care/backend
    python seed_disease_knowledge.py
    # Hoặc chạy với --check để kiểm tra mà không ghi vào DB
    python seed_disease_knowledge.py --check
"""
import sys
import json
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import engine, SessionLocal, Base
from models import DiseaseKnowledge
from disease_knowledge import DISEASE_INFO


def seed(check_only: bool = False):
    # Tạo bảng nếu chưa có
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing_count = db.query(DiseaseKnowledge).count()

        if check_only:
            print(f"📋 DB hiện có: {existing_count} bệnh")
            print(f"📋 disease_knowledge.py có: {len(DISEASE_INFO)} bệnh")
            db_labels = {r.label for r in db.query(DiseaseKnowledge.label).all()}
            missing = set(DISEASE_INFO.keys()) - db_labels
            extra = db_labels - set(DISEASE_INFO.keys())
            if missing:
                print(f"⚠  Chưa có trong DB: {missing}")
            if extra:
                print(f"ℹ  Trong DB nhưng không có trong file: {extra}")
            if not missing and not extra:
                print("✅ DB đã đồng bộ hoàn toàn với disease_knowledge.py")
            return

        inserted = 0
        updated = 0
        for label, info in DISEASE_INFO.items():
            xu_ly = info.get("xu_ly", [])
            xu_ly_json = json.dumps(xu_ly, ensure_ascii=False)

            existing = db.query(DiseaseKnowledge).filter(
                DiseaseKnowledge.label == label
            ).first()

            if existing:
                existing.mo_ta = info.get("mo_ta", "")
                existing.nguyen_nhan = info.get("nguyen_nhan", "")
                existing.xu_ly = xu_ly_json
                updated += 1
            else:
                row = DiseaseKnowledge(
                    label=label,
                    mo_ta=info.get("mo_ta", ""),
                    nguyen_nhan=info.get("nguyen_nhan", ""),
                    xu_ly=xu_ly_json,
                )
                db.add(row)
                inserted += 1

        db.commit()
        total = db.query(DiseaseKnowledge).count()
        print(f"✅ Hoàn tất:")
        print(f"   Thêm mới: {inserted}")
        print(f"   Cập nhật: {updated}")
        print(f"   Tổng trong DB: {total}")
        print()
        print("💡 Bạn có thể xóa disease_knowledge.py khi đã xác nhận mọi thứ hoạt động tốt.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true",
                        help="Chỉ kiểm tra, không ghi vào DB")
    args = parser.parse_args()
    seed(check_only=args.check)
