"""CRM note model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.contact import Contact
    from app.db.models.family import Family
    from app.db.models.organization import Organization
    from app.db.models.sales_lead import SalesLead


class CrmNote(Base):
    """Free-form note linked to one or more CRM entities."""

    __tablename__ = "crm_notes"
    __table_args__ = (
        CheckConstraint(
            (
                "contact_id IS NOT NULL OR family_id IS NOT NULL OR "
                "organization_id IS NOT NULL OR lead_id IS NOT NULL"
            ),
            name="crm_notes_has_parent",
        ),
        Index("crm_notes_contact_idx", "contact_id", "created_at"),
        Index("crm_notes_family_idx", "family_id", "created_at"),
        Index("crm_notes_lead_idx", "lead_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    contact_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    family_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="SET NULL"),
        nullable=True,
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("sales_leads.id", ondelete="SET NULL"),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(Text(), nullable=False)
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

    contact: Mapped[Contact | None] = relationship(
        "Contact",
        back_populates="crm_notes",
    )
    family: Mapped[Family | None] = relationship(
        "Family",
        back_populates="crm_notes",
    )
    organization: Mapped[Organization | None] = relationship(
        "Organization",
        back_populates="crm_notes",
    )
    lead: Mapped[SalesLead | None] = relationship(
        "SalesLead",
        back_populates="crm_notes",
    )
