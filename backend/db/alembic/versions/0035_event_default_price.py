"""Add default price and currency columns to event_details.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatibility: seed inserts into ``event_details`` gain server defaults for
   ``default_currency``; ``default_price`` remains NULL unless seed is extended.
2. NOT NULL: ``default_currency`` is NOT NULL with server default ``HKD``; existing rows OK.
3. Renamed/dropped: N/A.
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0035_event_default_price"
down_revision: Union[str, None] = "0034_drop_calendly_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_details",
        sa.Column("default_price", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "event_details",
        sa.Column(
            "default_currency",
            sa.String(length=3),
            nullable=False,
            server_default="HKD",
        ),
    )


def downgrade() -> None:
    op.drop_column("event_details", "default_currency")
    op.drop_column("event_details", "default_price")
