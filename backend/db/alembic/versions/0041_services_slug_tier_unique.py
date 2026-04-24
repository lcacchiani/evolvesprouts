"""Replace services slug-only unique index with slug + service_tier composite.

Seed-data assessment:
1. Compatibility: seed UPDATEs slugs only when exactly one candidate row exists
   (see `backend/db/seed/seed_data.sql`), avoiding accidental duplicate slugs.
2. NOT NULL: none; partial index still requires slug IS NOT NULL.
3. Dropped index `services_slug_unique_idx` replaced by
   `services_slug_tier_unique_idx` on (lower(slug), lower(service_tier)).
4. New tables: N/A.
5. Enum/values: N/A.
6. FK: N/A.

Note: PostgreSQL treats NULL as distinct in unique indexes by default; revision
`0042_slug_nulls_nd` replaces this index with NULLS NOT DISTINCT so duplicate
(slug, NULL tier) rows cannot coexist. Until 0042 is applied, only one NULL-tier
row per slug is enforced in practice by application behavior, not by this index alone.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0041_slug_tier_unique"
down_revision = "0040_service_tier_location"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS services_slug_unique_idx"))
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX services_slug_tier_unique_idx "
            "ON services (lower(slug), lower(service_tier)) "
            "WHERE slug IS NOT NULL"
        )
    )


def downgrade() -> None:
    """Restore slug-only uniqueness. Not safe after multiple tiers share one slug."""
    op.execute(sa.text("DROP INDEX IF EXISTS services_slug_tier_unique_idx"))
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX services_slug_unique_idx "
            "ON services (lower(slug)) WHERE slug IS NOT NULL"
        )
    )
