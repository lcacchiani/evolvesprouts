"""Add nullable partner-only slug on organizations with case-insensitive uniqueness.

Seed-data assessment:
1. Compatibility with existing seed SQL: seed does not insert `organizations` rows.
2. New NOT NULL/CHECK: column is nullable; no NOT NULL.
3. Renamed/dropped: N/A (additive).
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.

Result: No seed update — `backend/db/seed/seed_data.sql` does not reference `organizations`.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029_organizations_partner_slug"
down_revision: Union[str, None] = "0028_unify_notes_storage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("slug", sa.String(length=128), nullable=True),
    )
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX organizations_partner_slug_unique_idx "
            "ON organizations (lower(slug)) "
            "WHERE relationship_type = 'partner' AND slug IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS organizations_partner_slug_unique_idx"))
    op.drop_column("organizations", "slug")
