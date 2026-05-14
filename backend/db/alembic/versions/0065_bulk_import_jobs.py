"""Add bulk_expense_import_jobs for async combined-PDF imports.

Tracks queued OpenRouter bulk parses that exceed synchronous API limits.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: no seed inserts into this table.
2. NOT NULL columns: job rows are app-created only.
3. N/A.
4. No seed rows for operational job queue.
5. Job status strings are application-defined; no enum overlap with seed.
6. FKs reference ``assets`` and ``organizations`` (vendors); insert order is
   job creation after those entities exist.

Result: No seed updates required.

Revision id: ``0065_bulk_import_jobs`` (22 chars, <= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0065_bulk_import_jobs"
down_revision: Union[str, None] = "0064_invoice_bill_to_location"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    expense_status = postgresql.ENUM(
        "draft",
        "submitted",
        "paid",
        "voided",
        "amended",
        name="expense_status",
        create_type=False,
    )
    op.create_table(
        "bulk_expense_import_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column(
            "attachment_asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "default_vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("expense_status", expense_status, nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_expense_ids", postgresql.JSONB(), nullable=True),
        sa.Column("created_count", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
    )
    op.create_index(
        "ix_bulk_expense_import_jobs_created_by",
        "bulk_expense_import_jobs",
        ["created_by"],
    )
    op.create_index(
        "ix_bulk_expense_import_jobs_status",
        "bulk_expense_import_jobs",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_bulk_expense_import_jobs_status", table_name="bulk_expense_import_jobs"
    )
    op.drop_index(
        "ix_bulk_expense_import_jobs_created_by",
        table_name="bulk_expense_import_jobs",
    )
    op.drop_table("bulk_expense_import_jobs")
