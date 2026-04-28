"""Enrollment model for service instances."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from collections.abc import Iterable

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP, Numeric

from app.db.base import Base
from app.db.models.enums import EnrollmentStatus

if TYPE_CHECKING:
    from app.db.models.contact import Contact
    from app.db.models.discount_code import DiscountCode
    from app.db.models.family import Family
    from app.db.models.organization import Organization
    from app.db.models.service_instance import EventTicketTier, ServiceInstance


def _enum_values(enum_cls: Iterable[EnrollmentStatus]) -> list[str]:
    """Return enum labels stored in PostgreSQL."""
    return [member.value for member in enum_cls]


class Enrollment(Base):
    """Registration/booking for a service instance."""

    __tablename__ = "enrollments"
    __table_args__ = (
        CheckConstraint(
            "contact_id IS NOT NULL OR family_id IS NOT NULL OR organization_id IS NOT NULL",
            name="enrollments_has_parent",
        ),
        Index("enrollments_instance_idx", "instance_id"),
        Index("enrollments_contact_idx", "contact_id"),
        Index("enrollments_family_idx", "family_id"),
        Index("enrollments_org_idx", "organization_id"),
        Index("enrollments_status_idx", "status"),
        Index(
            "enrollments_instance_contact_uidx",
            "instance_id",
            "contact_id",
            unique=True,
            postgresql_where=text("contact_id IS NOT NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    instance_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_instances.id", ondelete="CASCADE"),
        nullable=False,
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
    ticket_tier_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("event_ticket_tiers.id", ondelete="SET NULL"),
        nullable=True,
    )
    discount_code_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("discount_codes.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(
            EnrollmentStatus,
            name="enrollment_status",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
        server_default=text("'registered'"),
    )
    amount_paid: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    enrolled_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
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

    instance: Mapped[ServiceInstance] = relationship(
        "ServiceInstance",
        back_populates="enrollments",
    )
    contact: Mapped[Contact | None] = relationship("Contact")
    family: Mapped[Family | None] = relationship("Family")
    organization: Mapped[Organization | None] = relationship("Organization")
    ticket_tier: Mapped[EventTicketTier | None] = relationship(
        "EventTicketTier",
        back_populates="enrollments",
    )
    discount_code: Mapped[DiscountCode | None] = relationship(
        "DiscountCode",
        back_populates="enrollments",
    )
