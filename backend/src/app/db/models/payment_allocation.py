"""Links customer payments to invoices (partial allocation support)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import CheckConstraint, ForeignKey, PrimaryKeyConstraint, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TIMESTAMP, Numeric

from app.db.base import Base


class PaymentAllocation(Base):
    """Allocation of payment amount to an invoice (optionally a line)."""

    __tablename__ = "payment_allocations"
    __table_args__ = (
        CheckConstraint("allocated_amount <> 0", name="payment_allocations_nonzero"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    payment_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("customer_payments.id", ondelete="CASCADE"),
        nullable=False,
    )
    invoice_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("customer_invoices.id", ondelete="CASCADE"),
        nullable=False,
    )
    invoice_line_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("customer_invoice_lines.id", ondelete="SET NULL"),
        nullable=True,
    )
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    reversal_of_allocation_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payment_allocations.id", ondelete="SET NULL"),
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


class DocumentCounter(Base):
    """Serialized invoice/receipt numbering per scope and year."""

    __tablename__ = "document_counters"
    __table_args__ = (PrimaryKeyConstraint("document_type", "scope_key", "year"),)

    document_type: Mapped[str] = mapped_column(sa.Text, nullable=False)
    scope_key: Mapped[str] = mapped_column(
        sa.Text, nullable=False, server_default=text("'default'")
    )
    year: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False)
    last_number: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, server_default=text("0")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
