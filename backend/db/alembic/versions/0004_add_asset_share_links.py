"""Create asset share-link table for stable bearer URLs.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` currently contains no asset rows and no
     inserts into related tables.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - New columns are introduced only in a new table and do not affect existing
     seed inserts.
3. Renamed/dropped columns reflected in seed data:
   - No existing columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - `asset_share_links` does not require mandatory bootstrap rows.
5. Enum/allowed-value changes validated in seed rows:
   - No enum definitions are changed.
6. FK/cascade changes validated for insert order and references:
   - `asset_share_links.asset_id` references `assets.id` with `ON DELETE
     CASCADE`; no seed insert order change is required.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004_add_asset_share_links"
down_revision: Union[str, None] = "0003_drop_asset_file_size"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create table for stable asset share links."""
    op.create_table(
        "asset_share_links",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("share_token", sa.String(128), nullable=False),
        sa.Column("created_by", sa.String(128), nullable=False),
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
    )
    op.create_index(
        "asset_share_links_token_idx",
        "asset_share_links",
        ["share_token"],
        unique=True,
    )
    op.create_index(
        "asset_share_links_asset_idx",
        "asset_share_links",
        ["asset_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop stable asset share-link table."""
    op.drop_index("asset_share_links_asset_idx", table_name="asset_share_links")
    op.drop_index("asset_share_links_token_idx", table_name="asset_share_links")
    op.drop_table("asset_share_links")
