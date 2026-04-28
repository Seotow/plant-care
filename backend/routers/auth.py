from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserRegister, UserLogin, UserUpdate, TokenResponse
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(body: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại")
    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
        location=body.location,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "full_name": user.full_name, "is_admin": bool(user.is_admin)},
    )


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Sai tên đăng nhập hoặc mật khẩu")
    token = create_token(user.id)
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "full_name": user.full_name, "is_admin": bool(user.is_admin)},
    )


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "phone": user.phone,
        "location": user.location,
        "is_admin": bool(user.is_admin),
    }


@router.put("/me")
def update_profile(body: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.new_password:
        if not body.current_password or not verify_password(body.current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
        user.hashed_password = hash_password(body.new_password)
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.phone is not None:
        user.phone = body.phone
    if body.location is not None:
        user.location = body.location
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "phone": user.phone,
        "location": user.location,
    }
