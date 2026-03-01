"""CRM tag and tag junction models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.contact import Contact
    from app.db.models.family import Family
    from app.db.models.organization import Organization


class Tag(Base):
    """Tag entity reusable across CRM entities."""

    __tablename__ = "tags"
    __table_args__ = (
        Index(
            "tags_name_unique_idx",
            text("lower(name)"),
            unique=True,
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    contact_tags: Mapped[list[ContactTag]] = relationship(
        "ContactTag",
        back_populates="tag",
        cascade="all, delete-orphan",
    )
    family_tags: Mapped[list[FamilyTag]] = relationship(
        "FamilyTag",
        back_populates="tag",
        cascade="all, delete-orphan",
    )
    organization_tags: Mapped[list[OrganizationTag]] = relationship(
        "OrganizationTag",
        back_populates="tag",
        cascade="all, delete-orphan",
    )


class ContactTag(Base):
    """Tag association for contacts."""

    __tablename__ = "contact_tags"

    contact_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    contact: Mapped[Contact] = relationship(
        "Contact",
        back_populates="contact_tags",
    )
    tag: Mapped[Tag] = relationship(
        "Tag",
        back_populates="contact_tags",
    )


class FamilyTag(Base):
    """Tag association for families."""

    __tablename__ = "family_tags"

    family_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    family: Mapped[Family] = relationship(
        "Family",
        back_populates="family_tags",
    )
    tag: Mapped[Tag] = relationship(
        "Tag",
        back_populates="family_tags",
    )


class OrganizationTag(Base):
    """Tag association for organizations."""

    __tablename__ = "organization_tags"

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    organization: Mapped[Organization] = relationship(
        "Organization",
        back_populates="organization_tags",
    )
    tag: Mapped[Tag] = relationship(
        "Tag",
        back_populates="organization_tags",
    )
