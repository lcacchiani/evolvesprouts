"""Drop landing_page from service instances.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatibility: seed does not reference ``service_instances.landing_page``.
2. NOT NULL: dropped column was nullable; no new constraints are introduced.
3. Renamed/dropped: ``landing_page`` is removed; seed is unaffected.
4. New tables: none.
5. Enum/allowed-value changes: none.
6. FK/cascade changes: none.

Irreversible data: upgrade permanently drops stored landing-page route keys.
Downgrade re-adds the nullable column, but previous values cannot be recovered.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0044_drop_landing_page"
down_revision: Union[str, None] = "0043_backfill_inst_slug"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("service_instances", "landing_page")


def downgrade() -> None:
    op.add_column(
        "service_instances",
        sa.Column("landing_page", sa.String(length=255), nullable=True),
    )
