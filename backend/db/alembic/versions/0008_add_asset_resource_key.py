"""Add optional assets.resource_key lookup field.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert into `assets`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - `assets.resource_key` is nullable and introduces no new CHECK constraints.
3. Renamed/dropped columns reflected in seed data:
   - No columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - No new tables are introduced.
5. Enum/allowed-value changes validated in seed rows:
   - No enum changes are introduced.
6. FK/cascade changes validated for insert order and references:
   - No FK or cascade behavior changes are introduced.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_add_asset_resource_key"
down_revision: Union[str, None] = "0007_add_crm_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add optional resource key lookup column to assets."""
    op.add_column("assets", sa.Column("resource_key", sa.String(length=64), nullable=True))
    op.create_index(
        "assets_resource_key_unique_idx",
        "assets",
        ["resource_key"],
        unique=True,
        postgresql_where=sa.text("resource_key IS NOT NULL"),
    )


def downgrade() -> None:
    """Drop resource key lookup column from assets."""
    op.drop_index("assets_resource_key_unique_idx", table_name="assets")
    op.drop_column("assets", "resource_key")
