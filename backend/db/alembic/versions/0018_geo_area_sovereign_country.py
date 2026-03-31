"""Link territories to sovereign country for geocoding country filters.

Adds ``sovereign_country_id`` (FK → geographic_areas) so geocoding can pass
comma-separated ISO country codes from DB rows (e.g. HK + China) without
hardcoding values in application code.

Seed-data assessment:
1. ``seed_data.sql`` does not touch ``geographic_areas``; compatible.
2. New column nullable; existing rows unchanged until UPDATE.
3. N/A
4. Migration inserts China (CN) if missing and sets sovereign links for HK/MO/TW;
   inserts MO/TW country rows if missing.
5. N/A
6. FK is self-referential on same table; no cross-table order issues.

Result: No changes required to ``seed_data.sql``.
"""

from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "0018_geo_area_sovereign"
down_revision: Union[str, None] = "0017_add_location_name"
branch_labels: Union[str, tuple[str, ...], None] = None
depends_on: Union[str, tuple[str, ...], None] = None


def upgrade() -> None:
    op.add_column(
        "geographic_areas",
        sa.Column(
            "sovereign_country_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geographic_areas.id", ondelete="SET NULL"),
            nullable=True,
            comment="Parent sovereign country row for geocoding ISO filters (e.g. HK → CN)",
        ),
    )

    conn = op.get_bind()

    conn.execute(
        text(
            """
            INSERT INTO geographic_areas (
                id, parent_id, name, name_translations, level, code,
                active, display_order, sovereign_country_id
            )
            SELECT gen_random_uuid(), NULL, 'China', '{}'::jsonb, 'country', 'CN',
                   true, 100, NULL
            WHERE NOT EXISTS (
                SELECT 1 FROM geographic_areas
                WHERE level = 'country' AND upper(trim(code)) = 'CN'
            )
            """
        )
    )

    cn_row = conn.execute(
        text(
            """
            SELECT id FROM geographic_areas
            WHERE level = 'country' AND upper(trim(code)) = 'CN'
            LIMIT 1
            """
        )
    ).fetchone()
    if cn_row is None:
        return
    cn_id = cn_row[0]

    conn.execute(
        text(
            """
            UPDATE geographic_areas
            SET sovereign_country_id = :cn
            WHERE level = 'country'
              AND upper(trim(code)) IN ('HK', 'MO', 'TW')
            """
        ),
        {"cn": cn_id},
    )

    conn.execute(
        text(
            """
            INSERT INTO geographic_areas (
                id, parent_id, name, name_translations, level, code,
                active, display_order, sovereign_country_id
            )
            SELECT gen_random_uuid(), NULL, 'Macau', '{}'::jsonb, 'country', 'MO',
                   true, 2, :cn
            WHERE NOT EXISTS (
                SELECT 1 FROM geographic_areas
                WHERE level = 'country' AND upper(trim(code)) = 'MO'
            )
            """
        ),
        {"cn": cn_id},
    )

    conn.execute(
        text(
            """
            INSERT INTO geographic_areas (
                id, parent_id, name, name_translations, level, code,
                active, display_order, sovereign_country_id
            )
            SELECT gen_random_uuid(), NULL, 'Taiwan', '{}'::jsonb, 'country', 'TW',
                   true, 3, :cn
            WHERE NOT EXISTS (
                SELECT 1 FROM geographic_areas
                WHERE level = 'country' AND upper(trim(code)) = 'TW'
            )
            """
        ),
        {"cn": cn_id},
    )


def downgrade() -> None:
    op.drop_column("geographic_areas", "sovereign_country_id")
