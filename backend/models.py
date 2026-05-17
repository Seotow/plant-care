from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base




class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    full_name = Column(String(100), default="")
    phone = Column(String(20), default="")
    location = Column(String(100), default="")
    is_admin = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    gardens = relationship("Garden", back_populates="owner", cascade="all, delete-orphan")
    detections = relationship("Detection", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")


class Garden(Base):
    __tablename__ = "gardens"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    crop_type = Column(String(100), default="")
    area = Column(String(50), default="")
    trees = Column(Integer, default=0)
    health_score = Column(Integer, default=100)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="gardens")
    detections = relationship("Detection", back_populates="garden", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="garden")


class Detection(Base):
    __tablename__ = "detections"
    id = Column(Integer, primary_key=True, index=True)
    garden_id = Column(Integer, ForeignKey("gardens.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_path = Column(String(255), default="")
    disease_label = Column(String(100), default="")
    disease_label_vi = Column(String(150), default="")
    confidence = Column(Float, default=0.0)
    bbox = Column(Text, default="[]")
    top_k = Column(Text, default="[]")
    center_x = Column(Float, default=0.0)
    center_y = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    garden = relationship("Garden", back_populates="detections")
    user = relationship("User", back_populates="detections")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    due_time = Column(String(20), default="")
    priority = Column(String(10), default="medium")
    completed = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    garden_id = Column(Integer, ForeignKey("gardens.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="tasks")
    garden = relationship("Garden", back_populates="tasks")


class DiseaseKnowledge(Base):
    """Cơ sở tri thức bệnh cây."""
    __tablename__ = "disease_knowledge"
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(150), unique=True, nullable=False, index=True)
    mo_ta = Column(Text, default="")
    nguyen_nhan = Column(Text, default="")
    xu_ly = Column(Text, default="[]")  # JSON array stored as text
    disease_class_id = Column(Integer, ForeignKey("disease_classes.id"), nullable=True)


class DiseaseClass(Base):
    __tablename__ = "disease_classes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    name_vi = Column(String(150), default="")
    plant_name_vi = Column(String(150), default="")
    disease_name_vi = Column(String(150), default="")
    treatment = Column(Text, default="")
    is_newly_approved = Column(Integer, default=0)
    is_builtin = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    prototype = relationship("DiseasePrototype", back_populates="disease_class", uselist=False, cascade="all, delete-orphan")
    samples = relationship("DiseaseSample", back_populates="disease_class", cascade="all, delete-orphan")


class DiseasePrototype(Base):
    __tablename__ = "disease_prototypes"
    id = Column(Integer, primary_key=True, index=True)
    disease_class_id = Column(Integer, ForeignKey("disease_classes.id"), unique=True, nullable=False)
    embedding = Column(LargeBinary, nullable=False)
    sample_count = Column(Integer, default=0)

    disease_class = relationship("DiseaseClass", back_populates="prototype")


class DiseaseSubmission(Base):
    """Đề xuất bệnh từ người dùng — chờ admin duyệt trước khi vào hệ thống chính."""
    __tablename__ = "disease_submissions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # display name (auto-generated)
    name_vi = Column(String(150), default="")
    plant_name_vi = Column(String(150), default="")   # tên cây tiếng Việt (bắt buộc)
    disease_name_vi = Column(String(150), default="")  # tên bệnh tiếng Việt (tuỳ chọn)
    treatment = Column(Text, default="")               # cách xử lý (admin điền khi duyệt)
    symptoms = Column(Text, default="")  # mô tả triệu chứng bằng text
    status = Column(String(20), default="pending")  # pending / approved / rejected
    reject_reason = Column(Text, default="")
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)

    submitter = relationship("User", foreign_keys=[submitted_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    samples = relationship("DiseaseSubmissionSample", back_populates="submission", cascade="all, delete-orphan")


class DiseaseSubmissionSample(Base):
    """Ảnh mẫu kèm theo đề xuất bệnh."""
    __tablename__ = "disease_submission_samples"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("disease_submissions.id"), nullable=False)
    image_path = Column(String(255), default="")

    submission = relationship("DiseaseSubmission", back_populates="samples")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DiseaseSample(Base):
    __tablename__ = "disease_samples"
    id = Column(Integer, primary_key=True, index=True)
    disease_class_id = Column(Integer, ForeignKey("disease_classes.id"), nullable=False)
    image_path = Column(String(255), nullable=False)
    embedding = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    disease_class = relationship("DiseaseClass", back_populates="samples")
