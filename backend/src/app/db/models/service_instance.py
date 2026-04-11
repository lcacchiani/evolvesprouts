"""Service instance and scheduling models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from collections.abc import Iterable

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP, Numeric

from app.db.base import Base
from app.db.models.enums import (
    ConsultationPricingModel,
    EventbriteSyncStatus,
    InstanceStatus,
    ServiceDeliveryMode,
    TrainingFormat,
    TrainingPricingUnit,
)

if TYPE_CHECKING:
    from app.db.models.discount_code import DiscountCode
    from app.db.models.enrollment import Enrollment
    from app.db.models.location import Location
    from app.db.models.service import Service


def _enum_values(
    enum_cls: Iterable[
        ServiceDeliveryMode
        | InstanceStatus
        | EventbriteSyncStatus
        | TrainingFormat
        | TrainingPricingUnit
        | ConsultationPricingModel
    ],
) -> list[str]:
    """Return enum labels stored in PostgreSQL."""
    return [member.value for member in enum_cls]


class ServiceInstance(Base):
    """Dated offering of a service template."""

    __tablename__ = "service_instances"
    __table_args__ = (
        Index("svc_instances_service_idx", "service_id"),
        Index("svc_instances_status_idx", "status"),
        Index("svc_instances_instructor_idx", "instructor_id"),
        Index("svc_instances_slug_uq", "slug", unique=True),
        CheckConstraint(
            "max_capacity IS NULL OR max_capacity > 0",
            name="service_instances_capacity_positive",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    service_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    slug: Mapped[str | None] = mapped_column(String(128), nullable=True)
    landing_page: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    cover_image_s3_key: Mapped[str | None] = mapped_column(String(), nullable=True)
    status: Mapped[InstanceStatus] = mapped_column(
        Enum(
            InstanceStatus,
            name="instance_status",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
        server_default=text("'scheduled'"),
    )
    delivery_mode: Mapped[ServiceDeliveryMode | None] = mapped_column(
        Enum(
            ServiceDeliveryMode,
            name="service_delivery_mode",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=True,
    )
    location_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    max_capacity: Mapped[int | None] = mapped_column(nullable=True)
    waitlist_enabled: Mapped[bool] = mapped_column(
        nullable=False,
        server_default=text("false"),
    )
    instructor_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
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
    eventbrite_event_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    eventbrite_event_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    eventbrite_sync_status: Mapped[EventbriteSyncStatus] = mapped_column(
        Enum(
            EventbriteSyncStatus,
            name="eventbrite_sync_status",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
        server_default=text("'pending'"),
    )
    eventbrite_last_synced_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    eventbrite_last_error: Mapped[str | None] = mapped_column(Text(), nullable=True)
    eventbrite_last_payload_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    eventbrite_ticket_class_map: Mapped[dict[str, str] | None] = mapped_column(
        JSONB(),
        nullable=True,
    )
    eventbrite_retry_count: Mapped[int] = mapped_column(
        nullable=False,
        server_default=text("0"),
    )

    service: Mapped[Service] = relationship(
        "Service",
        back_populates="instances",
    )
    location: Mapped[Location | None] = relationship("Location")
    session_slots: Mapped[list[InstanceSessionSlot]] = relationship(
        "InstanceSessionSlot",
        back_populates="instance",
        cascade="all, delete-orphan",
    )
    training_details: Mapped[TrainingInstanceDetails | None] = relationship(
        "TrainingInstanceDetails",
        back_populates="instance",
        cascade="all, delete-orphan",
        uselist=False,
    )
    ticket_tiers: Mapped[list[EventTicketTier]] = relationship(
        "EventTicketTier",
        back_populates="instance",
        cascade="all, delete-orphan",
    )
    consultation_details: Mapped[ConsultationInstanceDetails | None] = relationship(
        "ConsultationInstanceDetails",
        back_populates="instance",
        cascade="all, delete-orphan",
        uselist=False,
    )
    enrollments: Mapped[list[Enrollment]] = relationship(
        "Enrollment",
        back_populates="instance",
    )
    discount_codes: Mapped[list[DiscountCode]] = relationship(
        "DiscountCode",
        back_populates="instance",
    )


class InstanceSessionSlot(Base):
    """Individual date/time location block for an instance."""

    __tablename__ = "instance_session_slots"
    __table_args__ = (
        Index("session_slots_instance_idx", "instance_id"),
        CheckConstraint(
            "ends_at > starts_at",
            name="instance_session_slots_valid_range",
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
    location_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    starts_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )
    ends_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    instance: Mapped[ServiceInstance] = relationship(
        "ServiceInstance",
        back_populates="session_slots",
    )
    location: Mapped[Location | None] = relationship("Location")


class TrainingInstanceDetails(Base):
    """Training-specific instance details."""

    __tablename__ = "training_instance_details"

    instance_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_instances.id", ondelete="CASCADE"),
        primary_key=True,
    )
    training_format: Mapped[TrainingFormat] = mapped_column(
        Enum(
            TrainingFormat,
            name="training_format",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default=text("'HKD'"),
    )
    pricing_unit: Mapped[TrainingPricingUnit] = mapped_column(
        Enum(
            TrainingPricingUnit,
            name="training_pricing_unit",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
        server_default=text("'per_person'"),
    )

    instance: Mapped[ServiceInstance] = relationship(
        "ServiceInstance",
        back_populates="training_details",
    )


class EventTicketTier(Base):
    """Ticket tiers for event instances."""

    __tablename__ = "event_ticket_tiers"
    __table_args__ = (Index("ticket_tiers_instance_idx", "instance_id"),)

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
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default=text("'HKD'"),
    )
    max_quantity: Mapped[int | None] = mapped_column(nullable=True)
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    instance: Mapped[ServiceInstance] = relationship(
        "ServiceInstance",
        back_populates="ticket_tiers",
    )
    enrollments: Mapped[list[Enrollment]] = relationship(
        "Enrollment",
        back_populates="ticket_tier",
    )


class ConsultationInstanceDetails(Base):
    """Consultation-specific instance details."""

    __tablename__ = "consultation_instance_details"

    instance_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_instances.id", ondelete="CASCADE"),
        primary_key=True,
    )
    pricing_model: Mapped[ConsultationPricingModel] = mapped_column(
        Enum(
            ConsultationPricingModel,
            name="consultation_pricing_model",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default=text("'HKD'"),
    )
    package_sessions: Mapped[int | None] = mapped_column(nullable=True)
    calendly_event_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    instance: Mapped[ServiceInstance] = relationship(
        "ServiceInstance",
        back_populates="consultation_details",
    )
