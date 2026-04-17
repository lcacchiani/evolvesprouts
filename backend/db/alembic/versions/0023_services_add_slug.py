"""Add nullable referral slug column on services with case-insensitive uniqueness.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` adds UPDATEs for slug on known rows; safe when no match.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - Column is nullable; no NOT NULL.
3. Renamed/dropped columns reflected in seed data:
   - N/A (additive column).
4. New tables evaluated for seed rows:
   - N/A.
5. Enum/allowed-value changes validated in seed rows:
   - N/A.
6. FK/cascade changes validated for insert order and references:
   - N/A.

Result: seed updates set canonical slugs where services rows exist.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_services_add_slug"
down_revision: Union[str, None] = "0022_remove_crm_tickets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("services", sa.Column("slug", sa.String(length=80), nullable=True))
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX services_slug_unique_idx "
            "ON services (lower(slug)) WHERE slug IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS services_slug_unique_idx"))
    op.drop_column("services", "slug")
