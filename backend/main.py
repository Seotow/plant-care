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

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables + load ML models
    Base.metadata.create_all(bind=engine)
    print("Đang tải model AI...")
    app.state.predictor = PlantDiseasePredictor()
    print("Server sẵn sàng!")
    yield


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


@app.get("/")
def root():
    return {"message": "PlantCare API đang chạy", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
