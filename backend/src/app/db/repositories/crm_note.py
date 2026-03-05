"""Repository for CRM note entities."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.crm_note import CrmNote
from app.db.repositories.base import BaseRepository


class CrmNoteRepository(BaseRepository[CrmNote]):
    """Repository for CRM notes CRUD helpers."""

    def __init__(self, session: Session):
        super().__init__(session, CrmNote)

    def list_by_lead(self, *, lead_id: UUID) -> list[CrmNote]:
        """Return notes linked to a lead, newest first."""
        statement = (
            select(CrmNote)
            .where(CrmNote.lead_id == lead_id)
            .order_by(CrmNote.created_at.desc())
        )
        return list(self._session.execute(statement).scalars().all())
