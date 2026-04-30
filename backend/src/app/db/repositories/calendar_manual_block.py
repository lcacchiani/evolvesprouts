"""Repository for purpose-scoped manual calendar blocks."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.calendar_manual_block import CalendarManualBlock
from app.db.repositories.base import BaseRepository


class CalendarManualBlockRepository(BaseRepository[CalendarManualBlock]):
    """CRUD for ``calendar_manual_blocks``."""

    def __init__(self, session: Session):
        super().__init__(session, CalendarManualBlock)

    def list_for_purpose_between(
        self,
        *,
        purpose: str,
        start_date: date,
        end_date: date,
    ) -> list[CalendarManualBlock]:
        statement = (
            select(CalendarManualBlock)
            .where(CalendarManualBlock.purpose == purpose)
            .where(CalendarManualBlock.block_date >= start_date)
            .where(CalendarManualBlock.block_date <= end_date)
            .order_by(
                CalendarManualBlock.block_date.asc(), CalendarManualBlock.period.asc()
            )
        )
        return list(self._session.execute(statement).scalars().all())

    def get_by_id(self, row_id: UUID) -> CalendarManualBlock | None:
        return self._session.get(CalendarManualBlock, row_id)
