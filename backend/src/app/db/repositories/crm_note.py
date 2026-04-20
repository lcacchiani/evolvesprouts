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

    def list_standalone_for_contact(self, *, contact_id: UUID) -> list[CrmNote]:
        """Return contact-scoped notes not tied to a sales lead, newest first."""
        statement = (
            select(CrmNote)
            .where(
                CrmNote.contact_id == contact_id,
                CrmNote.lead_id.is_(None),
            )
            .order_by(CrmNote.created_at.desc())
        )
        return list(self._session.execute(statement).scalars().all())

    def get_standalone_for_contact(
        self, *, note_id: UUID, contact_id: UUID
    ) -> CrmNote | None:
        """Load a single standalone contact note if it belongs to the contact."""
        statement = select(CrmNote).where(
            CrmNote.id == note_id,
            CrmNote.contact_id == contact_id,
            CrmNote.lead_id.is_(None),
        )
        return self._session.execute(statement).scalar_one_or_none()
