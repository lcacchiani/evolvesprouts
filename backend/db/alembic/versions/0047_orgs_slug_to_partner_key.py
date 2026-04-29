"""Rename ``organizations.slug`` to ``organizations.partner_key``; rename unique index.

Seed-data assessment:
1. Seed does not insert organizations rows — no seed change.
2. NOT NULL: unchanged.
3. Renamed column only.
4. New tables: none.
5. Enum: none.
6. FK: none.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0047_orgs_slug_to_partner_key"
down_revision: Union[str, None] = "0046_services_slug_to_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("organizations", "slug", new_column_name="partner_key")
    op.execute(
        "ALTER INDEX IF EXISTS organizations_partner_slug_unique_idx "
        "RENAME TO organizations_partner_key_unique_idx"
    )


def downgrade() -> None:
    op.execute(
        "ALTER INDEX IF EXISTS organizations_partner_key_unique_idx "
        "RENAME TO organizations_partner_slug_unique_idx"
    )
    op.alter_column("organizations", "partner_key", new_column_name="slug")
