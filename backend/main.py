import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure backend/ is in path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database import engine, Base
from predictor import PlantDiseasePredictor
from routers.auth import router as auth_router
from routers.gardens import router as gardens_router
from routers.scan import router as scan_router
from routers.history import router as history_router
from routers.dashboard import router as dashboard_router
from routers.tasks import router as tasks_router
from routers.diseases import router as diseases_router
from routers.submissions import router as submissions_router
from routers.admin import router as admin_router

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "submissions").mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables + load ML models
    Base.metadata.create_all(bind=engine)
    print("\u0110ang tải model AI...")
    app.state.predictor = PlantDiseasePredictor()
    # Load custom disease prototypes from DB
    from database import SessionLocal
    db = SessionLocal()
    try:
        app.state.predictor.reload_prototypes(db)
        _seed_admin(db)
    finally:
        db.close()
    print("Server sẵn sàng!")
    yield


def _seed_admin(db):
    """Tạo tài khoản admin từ biến môi trường ADMIN_USERNAME / ADMIN_PASSWORD nếu chưa tồn tại."""
    import os
    from models import User
    from auth import hash_password
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
    existing = db.query(User).filter(User.username == admin_user).first()
    if existing:
        if not existing.is_admin:
            existing.is_admin = 1
            db.commit()
        return
    user = User(
        username=admin_user,
        hashed_password=hash_password(admin_pass),
        full_name="Quản trị viên",
        is_admin=1,
    )
    db.add(user)
    db.commit()
    print(f"[seed] Tạo admin: {admin_user}")


app = FastAPI(title="PlantCare API", version="1.0.0", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("422 Validation Error on %s %s: %s", request.method, request.url, exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth_router)
app.include_router(gardens_router)
app.include_router(scan_router)
app.include_router(history_router)
app.include_router(dashboard_router)
app.include_router(tasks_router)
app.include_router(diseases_router)
app.include_router(submissions_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {"message": "PlantCare API đang chạy", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
