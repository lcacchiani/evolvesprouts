"""Bulk combined-PDF expense import job tracking."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base
from app.db.models.enums import ExpenseStatus


class BulkExpenseImportJobStatus(str, enum.Enum):
    """Worker lifecycle for a bulk PDF import job."""

    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    SUCCEEDED_WITH_ERRORS = "succeeded_with_errors"
    FAILED = "failed"


def _bulk_job_status_values(enum_cls: object) -> list[str]:
    del enum_cls
    return [member.value for member in BulkExpenseImportJobStatus]


def _expense_status_values(enum_cls: object) -> list[str]:
    del enum_cls
    return [member.value for member in ExpenseStatus]


class BulkExpenseImportJob(Base):
    """Queued bulk import from a single combined PDF attachment."""

    __tablename__ = "bulk_expense_import_jobs"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    created_by: Mapped[str] = mapped_column(Text(), nullable=False)
    attachment_asset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
    )
    default_vendor_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    expense_status: Mapped[ExpenseStatus] = mapped_column(
        SAEnum(
            ExpenseStatus,
            name="expense_status",
            values_callable=_expense_status_values,
            create_type=False,
        ),
        nullable=False,
    )
    status: Mapped[BulkExpenseImportJobStatus] = mapped_column(
        SAEnum(
            BulkExpenseImportJobStatus,
            native_enum=False,
            length=32,
            values_callable=_bulk_job_status_values,
        ),
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text(), nullable=True)
    #: UUID strings in **creation order** (worker insertion order). GET job returns
    #: ``expenses`` in this same order when the job finished with successes.
    created_expense_ids: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    created_count: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("timezone('utc', now())"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("timezone('utc', now())"),
    )
