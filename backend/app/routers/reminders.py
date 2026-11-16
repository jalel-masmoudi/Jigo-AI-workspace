import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, list_limit, require_owned
from app.models import Reminder, User
from app.schemas import ReminderCreate, ReminderRead, ReminderUpdate

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderRead])
def list_reminders(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Depends(list_limit),
):
    return db.scalars(
        select(Reminder)
        .where(Reminder.user_id == user.id)
        .order_by(Reminder.due_at.asc(), Reminder.id.asc())
        .limit(limit)
    ).all()


@router.post("", response_model=ReminderRead, status_code=201)
def create_reminder(
    body: ReminderCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = Reminder(
        user_id=user.id,
        title=body.title,
        description=body.description,
        due_at=body.due_at,
        source_provider=body.source_provider,
        source_doc_id=body.source_doc_id,
        source_label=body.source_label,
        priority=body.priority,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.patch("/{reminder_id}", response_model=ReminderRead)
def update_reminder(
    reminder_id: uuid.UUID,
    body: ReminderUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = require_owned(db, Reminder, reminder_id, user, "Reminder")
    changes = body.model_dump(exclude_unset=True)
    if "title" in changes:
        reminder.title = changes["title"]
    if "description" in changes:
        reminder.description = changes["description"]
    if "due_at" in changes and changes["due_at"] is not None:
        reminder.due_at = changes["due_at"]
    if "priority" in changes and changes["priority"] is not None:
        reminder.priority = changes["priority"]
    if "completed" in changes and changes["completed"] is not None:
        reminder.completed = changes["completed"]
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=204)
def delete_reminder(
    reminder_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = require_owned(db, Reminder, reminder_id, user, "Reminder")
    db.delete(reminder)
    db.commit()
