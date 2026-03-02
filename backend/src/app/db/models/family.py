"""CRM family and membership models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from collections.abc import Iterable

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base
from app.db.models.enums import FamilyRole, RelationshipType

if TYPE_CHECKING:
    from app.db.models.contact import Contact
    from app.db.models.crm_note import CrmNote
    from app.db.models.location import Location
    from app.db.models.sales_lead import SalesLead
    from app.db.models.tag import FamilyTag, Tag


def _enum_values(enum_cls: Iterable[RelationshipType | FamilyRole]) -> list[str]:
    """Return enum labels stored in PostgreSQL."""
    return [member.value for member in enum_cls]


class Family(Base):
    """Family record in CRM."""

    __tablename__ = "families"
    __table_args__ = (Index("families_relationship_type_idx", "relationship_type"),)

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    family_name: Mapped[str] = mapped_column(String(150), nullable=False)
    relationship_type: Mapped[RelationshipType] = mapped_column(
        Enum(
            RelationshipType,
            name="relationship_type",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
        server_default=text("'prospect'"),
    )
    location_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
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

    family_members: Mapped[list[FamilyMember]] = relationship(
        "FamilyMember",
        back_populates="family",
        cascade="all, delete-orphan",
    )
    family_tags: Mapped[list[FamilyTag]] = relationship(
        "FamilyTag",
        back_populates="family",
        cascade="all, delete-orphan",
    )
    sales_leads: Mapped[list[SalesLead]] = relationship(
        "SalesLead",
        back_populates="family",
    )
    crm_notes: Mapped[list[CrmNote]] = relationship(
        "CrmNote",
        back_populates="family",
    )
    contacts: Mapped[list[Contact]] = relationship(
        "Contact",
        secondary="family_members",
        viewonly=True,
    )
    location: Mapped[Location | None] = relationship(
        "Location",
        back_populates="families",
    )
    tags: Mapped[list[Tag]] = relationship(
        "Tag",
        secondary="family_tags",
        viewonly=True,
    )


class FamilyMember(Base):
    """Membership row linking contacts to families."""

    __tablename__ = "family_members"
    __table_args__ = (
        UniqueConstraint("family_id", "contact_id"),
        Index("family_members_contact_idx", "contact_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    family_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
    )
    contact_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[FamilyRole] = mapped_column(
        Enum(
            FamilyRole,
            name="family_role",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    is_primary_contact: Mapped[bool] = mapped_column(
        Boolean(),
        nullable=False,
        server_default=text("false"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    family: Mapped[Family] = relationship(
        "Family",
        back_populates="family_members",
    )
    contact: Mapped[Contact] = relationship(
        "Contact",
        back_populates="family_members",
    )
