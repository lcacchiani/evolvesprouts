"""Drop legacy ``status`` column from CRM family/org tables if present.

Some environments may still carry a ``status`` column on ``families`` and/or
``organizations`` from earlier experiments. This migration removes it when
present so the canonical activeness model is ``archived_at`` only.

Seed-data assessment:
1. Compatibility: ``backend/db/seed/seed_data.sql`` does not reference these columns.
2. NOT NULL: N/A (column removal only when present).
3. Renamed/dropped: columns dropped only if they exist.
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.

Result: No seed update required.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030_drop_families_org_status"
down_revision: Union[str, None] = "0029_organizations_partner_slug"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TABLE families DROP COLUMN IF EXISTS status"))
    op.execute(sa.text("ALTER TABLE organizations DROP COLUMN IF EXISTS status"))


def downgrade() -> None:
    """Re-add nullable placeholder columns; original types may differ per environment."""
    op.add_column(
        "families",
        sa.Column("status", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("status", sa.String(length=64), nullable=True),
    )
