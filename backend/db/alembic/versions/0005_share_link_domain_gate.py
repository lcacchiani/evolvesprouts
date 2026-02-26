"""Add per-share-link allowed domains for source-domain gating.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert into `assets` or
     `asset_share_links`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - `allowed_domains` is added to an existing table with a server default, so
     existing rows remain valid and seed inserts are unaffected.
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

revision: str = "0005_share_link_domain_gate"
down_revision: Union[str, None] = "0004_add_asset_share_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add source-domain allowlist to stable share links."""
    op.add_column(
        "asset_share_links",
        sa.Column(
            "allowed_domains",
            postgresql.ARRAY(sa.String(length=255)),
            nullable=False,
            server_default=sa.text(
                "ARRAY['www.evolvesprouts.com','www-staging.evolvesprouts.com']::varchar[]"
            ),
        ),
    )


def downgrade() -> None:
    """Remove source-domain allowlist from stable share links."""
    op.drop_column("asset_share_links", "allowed_domains")
