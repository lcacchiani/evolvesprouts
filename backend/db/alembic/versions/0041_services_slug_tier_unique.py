"""Replace services slug-only unique index with slug + service_tier composite.

Seed-data assessment:
1. Compatibility: seed only UPDATEs slugs on known rows; no duplicate (slug, tier)
   pairs are introduced by seed.
2. NOT NULL: none; partial index still requires slug IS NOT NULL.
3. Dropped index `services_slug_unique_idx` replaced by
   `services_slug_tier_unique_idx` on (lower(slug), lower(service_tier)).
4. New tables: N/A.
5. Enum/values: N/A.
6. FK: N/A.

If production had duplicate (lower(slug), coalesce(lower(service_tier), '')) rows,
migration would fail until data is deduplicated (unlikely given prior slug-only
uniqueness unless tier was NULL for duplicates).
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
    op.execute(sa.text("DROP INDEX IF EXISTS services_slug_tier_unique_idx"))
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX services_slug_unique_idx "
            "ON services (lower(slug)) WHERE slug IS NOT NULL"
        )
    )
