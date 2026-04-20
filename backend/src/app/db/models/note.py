"""Generic polymorphic notes (separate from typed ``crm_notes``)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base

NOTE_ENTITY_TYPE_CONTACT = "contact"


class Note(Base):
    """Free-form note with optional links to multiple entities."""

    __tablename__ = "notes"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    content: Mapped[str] = mapped_column(Text(), nullable=False)
    took_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    links: Mapped[list["NoteEntityLink"]] = relationship(
        "NoteEntityLink",
        back_populates="note",
        cascade="all, delete-orphan",
    )


class NoteEntityLink(Base):
    """Polymorphic association between a note and a target entity."""

    __tablename__ = "note_entity_links"
    __table_args__ = (
        CheckConstraint(
            "entity_type IN ('contact')",
            name="note_entity_links_entity_type_allowed",
        ),
    )

    note_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        primary_key=True,
    )
    entity_type: Mapped[str] = mapped_column(Text(), primary_key=True)
    entity_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    note: Mapped[Note] = relationship("Note", back_populates="links")
