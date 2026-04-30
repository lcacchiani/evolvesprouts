"""Repository for purpose-scoped manual calendar blocks."""

from __future__ import annotations

from datetime import UTC, date, datetime
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

    def create_block(
        self,
        *,
        purpose: str,
        block_date: date,
        period: str,
        note: str | None,
        created_by: str | None = None,
    ) -> CalendarManualBlock:
        row = CalendarManualBlock(
            purpose=purpose,
            block_date=block_date,
            period=period,
            note=note,
            created_by=created_by,
            updated_by=None,
        )
        self._session.add(row)
        self._session.flush()
        self._session.refresh(row)
        return row
