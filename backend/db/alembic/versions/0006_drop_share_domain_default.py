"""Remove hardcoded DB default for share-link allowed domains.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert into `asset_share_links`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - No new constrained columns are added; existing NOT NULL behavior remains.
3. Renamed/dropped columns reflected in seed data:
   - No columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - No new tables are introduced.
5. Enum/allowed-value changes validated in seed rows:
   - No enum values are changed.
6. FK/cascade changes validated for insert order and references:
   - No FK definitions are changed.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006_drop_share_domain_default"
down_revision: Union[str, None] = "0005_share_link_domain_gate"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop server default so allowed domains come from runtime configuration."""
    op.alter_column(
        "asset_share_links",
        "allowed_domains",
        existing_type=postgresql.ARRAY(sa.String(length=255)),
        existing_nullable=False,
        server_default=None,
    )


def downgrade() -> None:
    """Restore a neutral array default for compatibility on downgrade."""
    op.alter_column(
        "asset_share_links",
        "allowed_domains",
        existing_type=postgresql.ARRAY(sa.String(length=255)),
        existing_nullable=False,
        server_default=sa.text("ARRAY[]::varchar[]"),
    )
