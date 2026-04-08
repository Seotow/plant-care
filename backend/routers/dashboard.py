from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from database import get_db
from models import User, Garden, Detection, Task
from auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/")
def get_dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    gardens = db.query(Garden).filter(Garden.owner_id == user.id).all()
    total_gardens = len(gardens)
    total_trees = sum(g.trees for g in gardens)
    avg_health = round(sum(g.health_score for g in gardens) / total_gardens) if total_gardens else 0

    today = datetime.now(timezone.utc).date()
    today_alerts = (
        db.query(Detection)
        .filter(Detection.user_id == user.id, func.date(Detection.created_at) == today)
        .count()
    )

    recent = (
        db.query(Detection)
        .filter(Detection.user_id == user.id)
        .order_by(Detection.created_at.desc())
        .limit(5)
        .all()
    )
    recent_list = []
    for r in recent:
        garden = db.query(Garden).filter(Garden.id == r.garden_id).first()
        recent_list.append({
            "id": r.id,
            "garden": garden.name if garden else "",
            "disease": r.disease_label,
            "disease_vi": r.disease_label_vi or "",
            "confidence": r.confidence,
            "createdAt": r.created_at.isoformat(),
        })

    tasks = (
        db.query(Task)
        .filter(Task.user_id == user.id, Task.completed == 0)
        .order_by(Task.created_at.desc())
        .limit(5)
        .all()
    )
    tasks_list = [
        {"id": t.id, "title": t.title, "dueTime": t.due_time, "priority": t.priority}
        for t in tasks
    ]

    return {
        "profile": {
            "name": user.full_name or user.username,
            "phone": user.phone,
            "location": user.location,
        },
        "summary": {
            "totalGardens": total_gardens,
            "totalTrees": total_trees,
            "healthScore": avg_health,
            "todayAlerts": today_alerts,
        },
        "recentDetections": recent_list,
        "tasks": tasks_list,
    }
