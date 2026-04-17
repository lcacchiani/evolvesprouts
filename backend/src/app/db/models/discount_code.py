"""Discount code model for services."""

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
from app.db.models.enums import DiscountType

if TYPE_CHECKING:
    from app.db.models.enrollment import Enrollment
    from app.db.models.service import Service
    from app.db.models.service_instance import ServiceInstance


def _enum_values(enum_cls: Iterable[DiscountType]) -> list[str]:
    """Return enum labels stored in PostgreSQL."""
    return [member.value for member in enum_cls]


class DiscountCode(Base):
    """Discount code with optional service/instance scope."""

    __tablename__ = "discount_codes"
    __table_args__ = (
        Index(
            "discount_codes_code_unique_idx",
            text("lower(code)"),
            unique=True,
        ),
        Index("discount_codes_service_idx", "service_id"),
        Index("discount_codes_instance_idx", "instance_id"),
        CheckConstraint(
            "(discount_type = 'referral' AND discount_value >= 0) "
            "OR (discount_type <> 'referral' AND discount_value > 0)",
            name="discount_codes_value_by_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    discount_type: Mapped[DiscountType] = mapped_column(
        Enum(
            DiscountType,
            name="discount_type",
            values_callable=_enum_values,
            create_type=False,
        ),
        nullable=False,
    )
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    valid_from: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    valid_until: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    service_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=True,
    )
    instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_instances.id", ondelete="CASCADE"),
        nullable=True,
    )
    max_uses: Mapped[int | None] = mapped_column(nullable=True)
    current_uses: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    active: Mapped[bool] = mapped_column(nullable=False, server_default=text("true"))
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

    service: Mapped[Service | None] = relationship(
        "Service",
        back_populates="discount_codes",
    )
    instance: Mapped[ServiceInstance | None] = relationship(
        "ServiceInstance",
        back_populates="discount_codes",
    )
    enrollments: Mapped[list[Enrollment]] = relationship(
        "Enrollment",
        back_populates="discount_code",
    )
