"""CRM organization and membership models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from collections.abc import Iterable

from sqlalchemy import Enum, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base
from app.db.models.enums import OrganizationRole, OrganizationType, RelationshipType

if TYPE_CHECKING:
    from app.db.models.contact import Contact
    from app.db.models.crm_note import CrmNote
    from app.db.models.location import Location
    from app.db.models.sales_lead import SalesLead
    from app.db.models.tag import OrganizationTag, Tag


def _enum_values(
    enum_cls: Iterable[OrganizationType | RelationshipType | OrganizationRole],
) -> list[str]:
    """Return enum labels stored in PostgreSQL."""
    return [member.value for member in enum_cls]


class Organization(Base):
    """Organization record in CRM."""

    __tablename__ = "organizations"
    __table_args__ = (
        Index("organizations_type_idx", "organization_type"),
        Index("organizations_relationship_type_idx", "relationship_type"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_type: Mapped[OrganizationType] = mapped_column(
        Enum(
            OrganizationType,
            name="organization_type",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
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
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
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

    organization_members: Mapped[list[OrganizationMember]] = relationship(
        "OrganizationMember",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    organization_tags: Mapped[list[OrganizationTag]] = relationship(
        "OrganizationTag",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    sales_leads: Mapped[list[SalesLead]] = relationship(
        "SalesLead",
        back_populates="organization",
    )
    crm_notes: Mapped[list[CrmNote]] = relationship(
        "CrmNote",
        back_populates="organization",
    )
    contacts: Mapped[list[Contact]] = relationship(
        "Contact",
        secondary="organization_members",
        viewonly=True,
    )
    location: Mapped[Location | None] = relationship(
        "Location",
        back_populates="organizations",
    )
    tags: Mapped[list[Tag]] = relationship(
        "Tag",
        secondary="organization_tags",
        viewonly=True,
    )


class OrganizationMember(Base):
    """Membership row linking contacts to organizations."""

    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "contact_id"),
        Index("organization_members_contact_idx", "contact_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    contact_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[OrganizationRole] = mapped_column(
        Enum(
            OrganizationRole,
            name="organization_role",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    organization: Mapped[Organization] = relationship(
        "Organization",
        back_populates="organization_members",
    )
    contact: Mapped[Contact] = relationship(
        "Contact",
        back_populates="organization_members",
    )
