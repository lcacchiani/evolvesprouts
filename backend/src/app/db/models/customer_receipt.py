"""Customer receipt (one per succeeded inbound payment)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP, Numeric

from app.db.base import Base


class CustomerReceipt(Base):
    """Proof of payment document."""

    __tablename__ = "customer_receipts"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    customer_payment_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("customer_payments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    receipt_number: Mapped[str] = mapped_column(Text(), nullable=False)
    receipt_sequence: Mapped[int] = mapped_column(nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    issued_pdf_s3_key: Mapped[str | None] = mapped_column(Text(), nullable=True)
    issued_pdf_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pdf_template_version: Mapped[str | None] = mapped_column(Text(), nullable=True)
    email_sent_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    ses_message_id: Mapped[str | None] = mapped_column(Text(), nullable=True)
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

    payment = relationship("CustomerPayment", backref="receipt_row")
