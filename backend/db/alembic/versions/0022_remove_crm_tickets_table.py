"""Remove CRM tickets table and enums (manager access / place suggestion workflow).

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not reference `tickets`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - N/A (table removed).
3. Renamed/dropped columns reflected in seed data:
   - N/A.
4. New tables evaluated for seed rows:
   - N/A.
5. Enum/allowed-value changes validated in seed rows:
   - N/A.
6. FK/cascade changes validated for insert order and references:
   - N/A.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0022_remove_crm_tickets"
down_revision: Union[str, None] = "0021_add_asset_content_lang"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS tickets CASCADE"))
    op.execute(sa.text("DROP TYPE IF EXISTS ticket_type"))
    op.execute(sa.text("DROP TYPE IF EXISTS ticket_status"))


def downgrade() -> None:
    ticket_type_enum = postgresql.ENUM(
        "access_request",
        "organization_suggestion",
        name="ticket_type",
        create_type=False,
    )
    ticket_status_enum = postgresql.ENUM(
        "pending",
        "approved",
        "rejected",
        name="ticket_status",
        create_type=False,
    )
    ticket_type_enum.create(op.get_bind(), checkfirst=True)
    ticket_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "tickets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("ticket_id", sa.Text(), nullable=False),
        sa.Column("ticket_type", ticket_type_enum, nullable=False),
        sa.Column("submitter_id", sa.Text(), nullable=False),
        sa.Column("submitter_email", sa.Text(), nullable=False),
        sa.Column("organization_name", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "status",
            ticket_status_enum,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.Text(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("suggested_district", sa.Text(), nullable=True),
        sa.Column("suggested_address", sa.Text(), nullable=True),
        sa.Column("suggested_lat", sa.Numeric(9, 6), nullable=True),
        sa.Column("suggested_lng", sa.Numeric(9, 6), nullable=True),
        sa.Column(
            "media_urls",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticket_id"),
    )
