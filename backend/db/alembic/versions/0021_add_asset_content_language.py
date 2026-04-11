"""Add content_language to assets for public client-resource listings.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` does not insert into `assets`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - `content_language` is nullable.
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

revision: str = "0021_add_asset_content_lang"
down_revision: Union[str, None] = "0020_instance_slug_landing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add optional BCP 47 / locale content language on assets."""
    op.add_column(
        "assets",
        sa.Column("content_language", sa.String(length=35), nullable=True),
    )


def downgrade() -> None:
    """Remove content language column."""
    op.drop_column("assets", "content_language")
