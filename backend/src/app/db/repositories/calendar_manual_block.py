"""Repository for purpose-scoped manual calendar blocks."""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import delete, select
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
            .order_by(CalendarManualBlock.block_date.asc(), CalendarManualBlock.period.asc())
        )
        return list(self._session.execute(statement).scalars().all())

    def get_by_id(self, row_id: UUID) -> CalendarManualBlock | None:
        return self._session.get(CalendarManualBlock, row_id)

    def create(
        self,
        *,
        purpose: str,
        block_date: date,
        period: str,
        note: str | None,
    ) -> CalendarManualBlock:
        row = CalendarManualBlock(
            purpose=purpose,
            block_date=block_date,
            period=period,
            note=note,
        )
        self._session.add(row)
        self._session.flush()
        self._session.refresh(row)
        return row

    def update_row(
        self,
        row_id: UUID,
        *,
        block_date: date,
        period: str,
        note: str | None,
    ) -> CalendarManualBlock | None:
        row = self.get_by_id(row_id)
        if row is None:
            return None
        row.block_date = block_date
        row.period = period
        row.note = note
        row.updated_at = datetime.now(tz=UTC)
        self._session.flush()
        self._session.refresh(row)
        return row

    def delete_by_id(self, row_id: UUID) -> bool:
        result = self._session.execute(
            delete(CalendarManualBlock).where(CalendarManualBlock.id == row_id)
        )
        return result.rowcount > 0
