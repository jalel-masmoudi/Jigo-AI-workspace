import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, list_limit, require_owned
from app.models import Document, User
from app.schemas import DocumentCreate, DocumentRead

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentRead])
def list_documents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Depends(list_limit),
):
    return db.scalars(
        select(Document)
        .where(Document.user_id == user.id)
        .order_by(Document.uploaded_at.desc(), Document.id.desc())
        .limit(limit)
    ).all()


@router.post("", response_model=DocumentRead, status_code=201)
def create_document(
    body: DocumentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = Document(
        user_id=user.id,
        name=body.name,
        file_type=body.file_type,
        size=body.size,
        status=body.status,
        summary=body.summary,
        source=body.source,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return require_owned(db, Document, document_id, user, "Document")


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = require_owned(db, Document, document_id, user, "Document")
    db.delete(document)
    db.commit()
