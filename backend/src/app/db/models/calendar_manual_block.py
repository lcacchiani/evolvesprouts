"""Generic manual calendar block rows (purpose-scoped)."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import text
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base


class CalendarManualBlock(Base):
    """Admin-managed half-day blocks merged with session-derived calendar blockers."""

    __tablename__ = "calendar_manual_blocks"
    __table_args__ = (
        UniqueConstraint(
            "purpose",
            "block_date",
            "period",
            name="calendar_manual_blocks_purpose_date_period_uidx",
        ),
        CheckConstraint(
            "period IN ('am', 'pm', 'both')",
            name="calendar_manual_blocks_period_chk",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    purpose: Mapped[str] = mapped_column(String(64), nullable=False)
    block_date: Mapped[date] = mapped_column(Date(), nullable=False)
    period: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=func.now(),
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
