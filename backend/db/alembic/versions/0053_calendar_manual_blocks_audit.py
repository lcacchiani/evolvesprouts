"""Add ``created_by`` / ``updated_by`` to ``calendar_manual_blocks``.

Seed-data assessment:
1. Seed compatibility: new nullable columns; no seed rows reference this table.
2. NOT NULL: not added; nullable for backfill.
3. N/A.
4. N/A.
5. N/A.
6. N/A.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0053_calendar_manual_blocks_audit"
down_revision: Union[str, None] = "0052_calendar_manual_blocks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "calendar_manual_blocks",
        sa.Column("created_by", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "calendar_manual_blocks",
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("calendar_manual_blocks", "updated_by")
    op.drop_column("calendar_manual_blocks", "created_by")
