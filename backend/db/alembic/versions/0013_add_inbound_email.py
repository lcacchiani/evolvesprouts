"""Add inbound email tracking table.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` remains compatible because the new table is operational.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - Constraints apply only to new operational rows created by inbound email processing.
3. Renamed/dropped columns reflected in seed data:
   - No existing columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - `inbound_emails` stores runtime ingest metadata and does not require seed rows.
5. Enum/allowed-value changes validated in seed rows:
   - No PostgreSQL enums are added; the new status values are enforced by a table check.
6. FK/cascade changes validated for insert order and references:
   - The nullable `expense_id` foreign key points to `expenses` and does not affect seed order.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0013_add_inbound_email"
down_revision: Union[str, None] = "0012_add_expense_vendor_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create inbound email tracking table."""
    op.create_table(
        "inbound_emails",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("ses_message_id", sa.String(255), nullable=False),
        sa.Column("recipient", sa.String(320), nullable=False),
        sa.Column("source_email", sa.String(320), nullable=True),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("received_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("raw_s3_bucket", sa.String(255), nullable=False),
        sa.Column("raw_s3_key", sa.Text(), nullable=False),
        sa.Column("spam_status", sa.String(32), nullable=True),
        sa.Column("virus_status", sa.String(32), nullable=True),
        sa.Column("spf_status", sa.String(32), nullable=True),
        sa.Column("dkim_status", sa.String(32), nullable=True),
        sa.Column("dmarc_status", sa.String(32), nullable=True),
        sa.Column(
            "processing_status",
            sa.String(32),
            nullable=False,
            server_default=sa.text("'received'"),
        ),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column(
            "expense_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("expenses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "processing_status IN ('received', 'processing', 'stored', 'skipped', 'failed')",
            name="inbound_emails_processing_status_check",
        ),
    )
    op.create_index(
        "inbound_emails_ses_message_id_idx",
        "inbound_emails",
        ["ses_message_id"],
        unique=True,
    )
    op.create_index(
        "inbound_emails_processing_status_idx",
        "inbound_emails",
        ["processing_status"],
    )
    op.create_index("inbound_emails_expense_id_idx", "inbound_emails", ["expense_id"])
    op.execute(
        """
        CREATE TRIGGER inbound_emails_set_updated_at
        BEFORE UPDATE ON inbound_emails
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    """Drop inbound email tracking table."""
    op.execute("DROP TRIGGER IF EXISTS inbound_emails_set_updated_at ON inbound_emails")
    op.drop_index("inbound_emails_expense_id_idx", table_name="inbound_emails")
    op.drop_index("inbound_emails_processing_status_idx", table_name="inbound_emails")
    op.drop_index("inbound_emails_ses_message_id_idx", table_name="inbound_emails")
    op.drop_table("inbound_emails")
