"""Drop assets.file_size_bytes column.

Seed-data assessment:
- `backend/db/seed/seed_data.sql` does not insert into `assets`, so no seed
  updates are required for this schema change.
"""

from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op

revision: str = "0003_drop_asset_file_size"
down_revision: Union[str, None] = "0002_drop_unused_domain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop file size metadata from assets."""
    op.execute(
        """
        ALTER TABLE IF EXISTS assets
        DROP COLUMN IF EXISTS file_size_bytes;
        """
    )


def downgrade() -> None:
    """Downgrade is not supported for destructive schema removal."""
    raise RuntimeError(
        "Downgrade is not supported for 0003_drop_asset_file_size."
    )
