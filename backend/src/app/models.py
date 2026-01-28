"""SQLAlchemy models for the application.

All datetime fields use timezone-aware UTC timestamps.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID as PyUUID

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


def utc_now() -> datetime:
    """Return the current UTC datetime with timezone info."""
    return datetime.now(timezone.utc)


class Family(Base):
    """Family entity representing a registered family.

    Attributes:
        id: Unique identifier (UUID).
        name: Family display name.
        primary_email: Primary contact email address.
        created_at: UTC timestamp when the family was created.
    """

    __tablename__ = 'families'

    id: PyUUID = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: str = Column(String(200), nullable=False)
    primary_email: str = Column(String(320), nullable=False, index=True)
    created_at: datetime = Column(DateTime(timezone=True), default=utc_now)

    def __repr__(self) -> str:
        return f'<Family(id={self.id}, name={self.name!r})>'


class Event(Base):
    """Event entity representing a scheduled event.

    Attributes:
        id: Unique identifier (UUID).
        title: Event title.
        description: Optional event description.
        location: Optional event location.
        starts_at: UTC timestamp when the event starts.
        ends_at: Optional UTC timestamp when the event ends.
        is_public: Whether the event is publicly visible.
        created_at: UTC timestamp when the event was created.
    """

    __tablename__ = 'events'

    id: PyUUID = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    title: str = Column(String(200), nullable=False)
    description: Optional[str] = Column(Text, nullable=True)
    location: Optional[str] = Column(String(200), nullable=True)
    starts_at: datetime = Column(DateTime(timezone=True), nullable=False)
    ends_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)
    is_public: bool = Column(Boolean, nullable=False, default=True)
    created_at: datetime = Column(DateTime(timezone=True), default=utc_now)

    def __repr__(self) -> str:
        return f'<Event(id={self.id}, title={self.title!r})>'
