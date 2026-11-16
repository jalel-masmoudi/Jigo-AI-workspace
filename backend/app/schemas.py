import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field


def _strip_required(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("must not be blank")
    return value


def _strip_optional(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _strip_if_present(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        raise ValueError("must not be blank")
    return value


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


RequiredText = Annotated[str, AfterValidator(_strip_required)]
OptionalText = Annotated[str | None, AfterValidator(_strip_optional)]
PresentText = Annotated[str | None, AfterValidator(_strip_if_present)]
UtcDateTime = Annotated[datetime, AfterValidator(_as_utc)]


class RegisterRequest(BaseModel):
    name: RequiredText = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class ConversationCreate(BaseModel):
    title: RequiredText = Field(default="New chat", min_length=1, max_length=200)


class ConversationUpdate(BaseModel):
    title: RequiredText = Field(min_length=1, max_length=200)


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    preview: str | None
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: RequiredText = Field(min_length=1, max_length=20000)


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    created_at: datetime


class DocumentCreate(BaseModel):
    name: RequiredText = Field(min_length=1, max_length=255)
    file_type: RequiredText = Field(min_length=1, max_length=50)
    size: RequiredText = Field(min_length=1, max_length=50)
    status: Literal["processed", "processing", "failed"] = "processing"
    summary: OptionalText = Field(default=None, max_length=10000)
    source: OptionalText = Field(default=None, max_length=500)


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    file_type: str
    size: str
    status: str
    summary: str | None
    source: str | None
    uploaded_at: datetime


class ReminderCreate(BaseModel):
    title: RequiredText = Field(min_length=1, max_length=200)
    description: OptionalText = Field(default=None, max_length=5000)
    due_at: UtcDateTime
    source_provider: Literal["google-meet", "notion", "slack", "jira"] | None = None
    source_doc_id: OptionalText = Field(default=None, max_length=200)
    source_label: OptionalText = Field(default=None, max_length=200)
    priority: Literal["low", "medium", "high"] = "medium"


class ReminderUpdate(BaseModel):
    title: PresentText = Field(default=None, min_length=1, max_length=200)
    description: OptionalText = Field(default=None, max_length=5000)
    due_at: UtcDateTime | None = None
    priority: Literal["low", "medium", "high"] | None = None
    completed: bool | None = None


class ReminderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    due_at: datetime
    source_provider: str | None
    source_doc_id: str | None
    source_label: str | None
    priority: str
    completed: bool
    created_at: datetime
