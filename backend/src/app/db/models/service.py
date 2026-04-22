"""Service template and service metadata models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from collections.abc import Iterable

from sqlalchemy import Enum, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP, Numeric

from app.db.base import Base
from app.db.models.enums import (
    ConsultationFormat,
    ConsultationPricingModel,
    EventCategory,
    ServiceDeliveryMode,
    ServiceStatus,
    ServiceType,
    TrainingPricingUnit,
)

if TYPE_CHECKING:
    from app.db.models.asset import Asset
    from app.db.models.discount_code import DiscountCode
    from app.db.models.service_instance import ServiceInstance
    from app.db.models.tag import Tag


def _enum_values(
    enum_cls: Iterable[
        ServiceType
        | ServiceStatus
        | ServiceDeliveryMode
        | TrainingPricingUnit
        | EventCategory
        | ConsultationFormat
        | ConsultationPricingModel
    ],
) -> list[str]:
    """Return enum labels stored in PostgreSQL."""
    return [member.value for member in enum_cls]


class Service(Base):
    """Reusable service template."""

    __tablename__ = "services"
    __table_args__ = (
        Index("services_type_idx", "service_type"),
        Index("services_status_idx", "status"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    service_type: Mapped[ServiceType] = mapped_column(
        Enum(
            ServiceType,
            name="service_type",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(80), nullable=True)
    booking_system: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    cover_image_s3_key: Mapped[str | None] = mapped_column(String(), nullable=True)
    delivery_mode: Mapped[ServiceDeliveryMode] = mapped_column(
        Enum(
            ServiceDeliveryMode,
            name="service_delivery_mode",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    status: Mapped[ServiceStatus] = mapped_column(
        Enum(
            ServiceStatus,
            name="service_status",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
        server_default=text("'draft'"),
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

    training_course_details: Mapped[TrainingCourseDetails | None] = relationship(
        "TrainingCourseDetails",
        back_populates="service",
        cascade="all, delete-orphan",
        uselist=False,
    )
    event_details: Mapped[EventDetails | None] = relationship(
        "EventDetails",
        back_populates="service",
        cascade="all, delete-orphan",
        uselist=False,
    )
    consultation_details: Mapped[ConsultationDetails | None] = relationship(
        "ConsultationDetails",
        back_populates="service",
        cascade="all, delete-orphan",
        uselist=False,
    )
    instances: Mapped[list[ServiceInstance]] = relationship(
        "ServiceInstance",
        back_populates="service",
        cascade="all, delete-orphan",
    )
    service_tags: Mapped[list[ServiceTag]] = relationship(
        "ServiceTag",
        back_populates="service",
        cascade="all, delete-orphan",
    )
    service_assets: Mapped[list[ServiceAsset]] = relationship(
        "ServiceAsset",
        back_populates="service",
        cascade="all, delete-orphan",
    )
    tags: Mapped[list[Tag]] = relationship(
        "Tag",
        secondary="service_tags",
        viewonly=True,
    )
    assets: Mapped[list[Asset]] = relationship(
        "Asset",
        secondary="service_assets",
        viewonly=True,
    )
    discount_codes: Mapped[list[DiscountCode]] = relationship(
        "DiscountCode",
        back_populates="service",
    )


class TrainingCourseDetails(Base):
    """Type-specific detail row for training-course services."""

    __tablename__ = "training_course_details"

    service_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        primary_key=True,
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
    default_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    default_currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default=text("'HKD'"),
    )

    service: Mapped[Service] = relationship(
        "Service",
        back_populates="training_course_details",
    )


class EventDetails(Base):
    """Type-specific detail row for event services."""

    __tablename__ = "event_details"

    service_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        primary_key=True,
    )
    event_category: Mapped[EventCategory] = mapped_column(
        Enum(
            EventCategory,
            name="event_category",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    default_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    default_currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default=text("'HKD'"),
    )

    service: Mapped[Service] = relationship(
        "Service",
        back_populates="event_details",
    )


class ConsultationDetails(Base):
    """Type-specific detail row for consultation services."""

    __tablename__ = "consultation_details"

    service_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        primary_key=True,
    )
    consultation_format: Mapped[ConsultationFormat] = mapped_column(
        Enum(
            ConsultationFormat,
            name="consultation_format",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    max_group_size: Mapped[int | None] = mapped_column(nullable=True)
    duration_minutes: Mapped[int] = mapped_column(nullable=False)
    pricing_model: Mapped[ConsultationPricingModel] = mapped_column(
        Enum(
            ConsultationPricingModel,
            name="consultation_pricing_model",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    default_hourly_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    default_package_price: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    default_package_sessions: Mapped[int | None] = mapped_column(nullable=True)
    default_currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default=text("'HKD'"),
    )

    service: Mapped[Service] = relationship(
        "Service",
        back_populates="consultation_details",
    )


class ServiceTag(Base):
    """Service-to-tag association."""

    __tablename__ = "service_tags"

    service_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
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

    service: Mapped[Service] = relationship(
        "Service",
        back_populates="service_tags",
    )
    tag: Mapped[Tag] = relationship("Tag")


class ServiceAsset(Base):
    """Service-to-asset association."""

    __tablename__ = "service_assets"

    service_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        primary_key=True,
    )
    asset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    service: Mapped[Service] = relationship(
        "Service",
        back_populates="service_assets",
    )
    asset: Mapped[Asset] = relationship("Asset")
