"""One-time DB migration — add new columns to existing tables.

Run:  python migrate.py
"""
import sys
from database import engine
from sqlalchemy import text

MIGRATIONS = [
    # disease_classes: tên cây/bệnh riêng, cách xử lý, badge mới
    "ALTER TABLE disease_classes ADD COLUMN plant_name_vi VARCHAR(150) DEFAULT ''",
    "ALTER TABLE disease_classes ADD COLUMN disease_name_vi VARCHAR(150) DEFAULT ''",
    "ALTER TABLE disease_classes ADD COLUMN treatment TEXT DEFAULT ''",
    "ALTER TABLE disease_classes ADD COLUMN is_newly_approved INTEGER DEFAULT 0",
    # disease_submissions: tên cây/bệnh tiếng Việt (user chỉ biết tiếng Việt)
    "ALTER TABLE disease_submissions ADD COLUMN plant_name_vi VARCHAR(150) DEFAULT ''",
    "ALTER TABLE disease_submissions ADD COLUMN disease_name_vi VARCHAR(150) DEFAULT ''",
    "ALTER TABLE disease_submissions ADD COLUMN treatment TEXT DEFAULT ''",
    # disease_knowledge: liên kết đến disease_class (cho bệnh tùy chỉnh)
    "ALTER TABLE disease_knowledge ADD COLUMN disease_class_id INTEGER REFERENCES disease_classes(id)",
]


def run():
    with engine.connect() as conn:
        for stmt in MIGRATIONS:
            try:
                conn.execute(text(stmt))
                conn.commit()
                print(f"  OK  {stmt[:80]}")
            except Exception as exc:
                msg = str(exc).lower()
                if "duplicate column" in msg or "already exists" in msg:
                    print(f" SKIP {stmt[:80]}")
                else:
                    print(f"  ERR {exc}", file=sys.stderr)
                    conn.rollback()


if __name__ == "__main__":
    run()
