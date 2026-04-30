"""Customer (AR) payment and refund rows."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import CheckConstraint, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP, Numeric

from app.db.base import Base
from app.db.models.enums import (
    BillingPaymentDirection,
    BillingPaymentStatus,
)

if TYPE_CHECKING:
    from app.db.models.contact import Contact
    from app.db.models.enrollment import Enrollment


def _billing_dir_values(
    _enum_cls: type[BillingPaymentDirection] | None = None,
) -> list[str]:
    return [e.value for e in BillingPaymentDirection]


def _billing_status_values(
    _enum_cls: type[BillingPaymentStatus] | None = None,
) -> list[str]:
    return [e.value for e in BillingPaymentStatus]


class CustomerPayment(Base):
    """Inbound payment or refund (refund links via ``original_payment_id``)."""

    __tablename__ = "customer_payments"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="customer_payments_amount_positive"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    direction: Mapped[BillingPaymentDirection] = mapped_column(
        sa.Enum(
            BillingPaymentDirection,
            name="billing_payment_direction",
            values_callable=_billing_dir_values,
            create_type=False,
        ),
        nullable=False,
        server_default=text("'inbound'"),
    )
    status: Mapped[BillingPaymentStatus] = mapped_column(
        sa.Enum(
            BillingPaymentStatus,
            name="billing_payment_status",
            values_callable=_billing_status_values,
            create_type=False,
        ),
        nullable=False,
        server_default=text("'pending'"),
    )
    method: Mapped[str] = mapped_column(String(64), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    original_payment_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("customer_payments.id", ondelete="SET NULL"),
        nullable=True,
    )
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True, unique=True
    )
    stripe_refund_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True, unique=True
    )
    external_reference: Mapped[str | None] = mapped_column(Text(), nullable=True)
    succeeded_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    confirmed_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    enrollment_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="SET NULL"),
        nullable=True,
    )
    contact_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
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

    original_payment: Mapped[CustomerPayment | None] = relationship(
        "CustomerPayment",
        remote_side="CustomerPayment.id",
    )
    enrollment: Mapped[Enrollment | None] = relationship("Enrollment")
    contact: Mapped[Contact | None] = relationship("Contact")

    def to_audit_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "direction": self.direction.value,
            "status": self.status.value,
            "method": self.method,
            "amount": str(self.amount),
            "currency": self.currency,
            "original_payment_id": str(self.original_payment_id)
            if self.original_payment_id
            else None,
            "stripe_payment_intent_id": self.stripe_payment_intent_id,
            "stripe_refund_id": self.stripe_refund_id,
            "enrollment_id": str(self.enrollment_id) if self.enrollment_id else None,
            "contact_id": str(self.contact_id) if self.contact_id else None,
        }
