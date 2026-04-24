"""Recreate services_slug_tier_unique_idx with NULLS NOT DISTINCT.

PostgreSQL treats NULL as distinct in unique indexes by default; without
NULLS NOT DISTINCT, two rows with the same slug and NULL service_tier would
not violate the index. This revision replaces the index from 0041 with an
equivalent definition that treats NULL tier like a single value.

Pre-upgrade guard: fails if duplicate (lower(slug), service_tier) pairs exist
among rows with slug set (including multiple NULL tiers for the same slug).

Seed-data assessment:
1. Seed `UPDATE services SET slug = ...` is tightened (see seed_data.sql) so
   slugs are only set when exactly one candidate row exists, avoiding accidental
   duplicate slugs from broad title matches.
2. NOT NULL: unchanged.
3. Index only: replaces `services_slug_tier_unique_idx` DDL.
4. New tables: N/A.
5. Enum/values: N/A.
6. FK: N/A.

Downgrade: restores the 0041 index (without NULLS NOT DISTINCT). This is not
reversible in production once distinct tiers share a slug: re-applying the
slug-only unique index would fail. Prefer forward-only migration in deployed
environments.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0042_slug_nulls_nd"
down_revision = "0041_slug_tier_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            DECLARE dup_count int;
            BEGIN
              SELECT count(*) INTO dup_count FROM (
                SELECT lower(slug) AS ls, service_tier
                FROM services
                WHERE slug IS NOT NULL
                GROUP BY lower(slug), service_tier
                HAVING count(*) > 1
              ) d;
              IF dup_count > 0 THEN
                RAISE EXCEPTION
                  'services: duplicate (slug, service_tier) rows exist; dedupe before upgrade';
              END IF;
            END $$;
            """
        )
    )
    op.execute(sa.text("DROP INDEX IF EXISTS services_slug_tier_unique_idx"))
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX services_slug_tier_unique_idx "
            "ON services (lower(slug), lower(service_tier)) NULLS NOT DISTINCT "
            "WHERE slug IS NOT NULL"
        )
    )


def downgrade() -> None:
    """Restore 0041 index semantics (not safe if multiple tiers share one slug)."""
    op.execute(sa.text("DROP INDEX IF EXISTS services_slug_tier_unique_idx"))
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX services_slug_tier_unique_idx "
            "ON services (lower(slug), lower(service_tier)) "
            "WHERE slug IS NOT NULL"
        )
    )
