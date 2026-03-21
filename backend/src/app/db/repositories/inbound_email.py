"""Repository for inbound email ingestion records."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import InboundEmail
from app.db.repositories.base import BaseRepository


class InboundEmailRepository(BaseRepository[InboundEmail]):
    """Repository for idempotent inbound email processing records."""

    def __init__(self, session: Session):
        super().__init__(session, InboundEmail)

    def find_by_ses_message_id(self, ses_message_id: str) -> InboundEmail | None:
        """Return a tracking record by SES message id."""
        normalized = ses_message_id.strip()
        if not normalized:
            return None
        statement = select(InboundEmail).where(
            InboundEmail.ses_message_id == normalized
        )
        return self._session.execute(statement).scalar_one_or_none()
