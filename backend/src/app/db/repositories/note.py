"""Note repository."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.db.models.note import Note
from app.db.repositories.base import BaseRepository


class NoteRepository(BaseRepository[Note]):
    """Persistence helpers for ``Note`` rows."""

    def __init__(self, session):
        super().__init__(session, Note)

    def list_by_lead(self, *, lead_id: UUID) -> list[Note]:
        statement = (
            select(Note).where(Note.lead_id == lead_id).order_by(Note.created_at.desc())
        )
        return list(self.session.scalars(statement).all())

    def list_standalone_for_contact(self, *, contact_id: UUID) -> list[Note]:
        statement = (
            select(Note)
            .where(
                Note.contact_id == contact_id,
                Note.lead_id.is_(None),
            )
            .order_by(Note.created_at.desc())
        )
        return list(self.session.scalars(statement).all())

    def get_standalone_for_contact(
        self,
        *,
        contact_id: UUID,
        note_id: UUID,
    ) -> Note | None:
        statement = select(Note).where(
            Note.id == note_id,
            Note.contact_id == contact_id,
            Note.lead_id.is_(None),
        )
        return self.session.scalar(statement)
