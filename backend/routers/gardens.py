from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Garden
from schemas import GardenCreate, GardenUpdate, GardenOut
from auth import get_current_user

router = APIRouter(prefix="/api/gardens", tags=["gardens"])


@router.get("/", response_model=list[GardenOut])
def list_gardens(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Garden)
        .filter(Garden.owner_id == user.id)
        .order_by(Garden.created_at.desc())
        .all()
    )


@router.post("/", response_model=GardenOut, status_code=201)
def create_garden(body: GardenCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    garden = Garden(**body.model_dump(), owner_id=user.id)
    db.add(garden)
    db.commit()
    db.refresh(garden)
    return garden


@router.get("/{garden_id}", response_model=GardenOut)
def get_garden(garden_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == user.id).first()
    if not garden:
        raise HTTPException(status_code=404, detail="Không tìm thấy vườn")
    return garden


@router.put("/{garden_id}", response_model=GardenOut)
def update_garden(
    garden_id: int, body: GardenUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == user.id).first()
    if not garden:
        raise HTTPException(status_code=404, detail="Không tìm thấy vườn")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(garden, key, val)
    db.commit()
    db.refresh(garden)
    return garden


@router.delete("/{garden_id}", status_code=204)
def delete_garden(garden_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    garden = db.query(Garden).filter(Garden.id == garden_id, Garden.owner_id == user.id).first()
    if not garden:
        raise HTTPException(status_code=404, detail="Không tìm thấy vườn")
    db.delete(garden)
    db.commit()
