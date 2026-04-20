"""Mapping from legacy CRM keys to Aurora primary keys (soft pointer, no FK)."""

from __future__ import annotations

from datetime import datetime
from datetime import timezone
from uuid import UUID

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base


class LegacyImportRef(Base):
    """Tracks legacy id → new row id for idempotent re-imports."""

    __tablename__ = "legacy_import_refs"

    entity: Mapped[str] = mapped_column(Text(), primary_key=True)
    legacy_key: Mapped[str] = mapped_column(Text(), primary_key=True)
    new_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    imported_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
