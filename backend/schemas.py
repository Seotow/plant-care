from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Auth ──
class UserRegister(BaseModel):
    username: str
    password: str
    full_name: str = ""
    phone: str = ""
    location: str = ""


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── Garden ──
class GardenCreate(BaseModel):
    name: str
    crop_type: str = ""
    area: str = ""
    trees: int = 0


class GardenUpdate(BaseModel):
    name: Optional[str] = None
    crop_type: Optional[str] = None
    area: Optional[str] = None
    trees: Optional[int] = None
    health_score: Optional[int] = None


class GardenOut(BaseModel):
    id: int
    name: str
    crop_type: str
    area: str
    trees: int
    health_score: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Task ──
class TaskCreate(BaseModel):
    title: str
    due_time: str = ""
    priority: str = "medium"
    garden_id: Optional[int] = None


class TaskOut(BaseModel):
    id: int
    title: str
    due_time: str
    priority: str
    completed: bool
    garden_id: Optional[int]
    created_at: datetime
    model_config = {"from_attributes": True}
