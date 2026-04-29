"""Add generic ``calendar_manual_blocks`` for manual calendar blockers.

Manual rows are merged at read time with session-derived blocks (event and
training_course instance slots intersecting nominal consultation half-day
windows) for each ``purpose`` value consumed by public clients.

Seed-data assessment:
1. Seed compatibility: new table; no seed rows required (empty default).
2. NOT NULL: new columns have defaults or are required; no seed inserts needed.
3. N/A.
4. N/A.
5. N/A.
6. N/A.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0052_calendar_manual_blocks"
down_revision: Union[str, None] = "0051_backfill_event_service_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "calendar_manual_blocks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("purpose", sa.String(length=64), nullable=False),
        sa.Column("block_date", sa.Date(), nullable=False),
        sa.Column("period", sa.String(length=8), nullable=False),
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
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint("id", name="calendar_manual_blocks_pkey"),
        sa.CheckConstraint(
            "period IN ('am', 'pm', 'both')",
            name="calendar_manual_blocks_period_chk",
        ),
        sa.UniqueConstraint(
            "purpose",
            "block_date",
            "period",
            name="calendar_manual_blocks_purpose_date_period_uidx",
        ),
    )
    op.create_index(
        "calendar_manual_blocks_purpose_date_idx",
        "calendar_manual_blocks",
        ["purpose", "block_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "calendar_manual_blocks_purpose_date_idx", table_name="calendar_manual_blocks"
    )
    op.drop_table("calendar_manual_blocks")
