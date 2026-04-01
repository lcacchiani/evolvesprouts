"""Add slug and landing_page to service instances.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert into `service_instances`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - Both columns are nullable; no server defaults required.
3. Renamed/dropped columns reflected in seed data:
   - No renamed or dropped columns.
4. New tables evaluated for seed rows:
   - No new tables in this migration.
5. Enum/allowed-value changes validated in seed rows:
   - No enum changes.
6. FK/cascade changes validated for insert order and references:
   - No new foreign keys in this migration.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020_instance_slug_landing"
down_revision: Union[str, None] = "0019_eventbrite_sync"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add public-facing slug and landing page key columns."""
    op.add_column(
        "service_instances",
        sa.Column("slug", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "service_instances",
        sa.Column("landing_page", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "svc_instances_slug_uq",
        "service_instances",
        ["slug"],
        unique=True,
    )


def downgrade() -> None:
    """Remove slug and landing page columns."""
    op.drop_index("svc_instances_slug_uq", table_name="service_instances")
    op.drop_column("service_instances", "landing_page")
    op.drop_column("service_instances", "slug")
