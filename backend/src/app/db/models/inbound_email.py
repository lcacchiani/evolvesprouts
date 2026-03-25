"""Inbound email ingestion tracking model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base
from app.db.models.enums import InboundEmailStatus

if TYPE_CHECKING:
    from app.db.models.expense import Expense


class InboundEmail(Base):
    """Tracks inbound emails received through SES for idempotent processing."""

    __tablename__ = "inbound_emails"
    __table_args__ = (
        CheckConstraint(
            "processing_status IN ('received', 'processing', 'stored', 'skipped', 'failed')",
            name="inbound_emails_processing_status_check",
        ),
        Index("inbound_emails_ses_message_id_idx", "ses_message_id", unique=True),
        Index("inbound_emails_processing_status_idx", "processing_status"),
        Index("inbound_emails_expense_id_idx", "expense_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    ses_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient: Mapped[str] = mapped_column(String(320), nullable=False)
    source_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )
    raw_s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_s3_key: Mapped[str] = mapped_column(Text(), nullable=False)
    spam_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    virus_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    spf_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    dkim_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    dmarc_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default=text("'received'"),
        default=InboundEmailStatus.RECEIVED.value,
    )
    failure_reason: Mapped[str | None] = mapped_column(Text(), nullable=True)
    expense_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="SET NULL"),
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

    expense: Mapped[Expense | None] = relationship("Expense")
