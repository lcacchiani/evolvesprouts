"""Add nullable ``booking_system`` text column on ``services``.

Seed-data assessment:
1. Compatibility: ``backend/db/seed/seed_data.sql`` inserts into ``services``;
   new column is nullable with no default required.
2. NOT NULL: N/A (nullable).
3. Renamed/dropped: N/A.
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.

Result: No seed update required.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032_services_booking"
down_revision: Union[str, None] = "0031_org_member_primary"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "services",
        sa.Column("booking_system", sa.String(length=80), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("services", "booking_system")
