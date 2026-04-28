"""Backfill ``service_instances.slug`` for NULL/empty rows (mostly consultations).

Uses deterministic bases derived from instance id and optional title, with the
same window-function collision handling as ``0043_backfill_inst_slug``.

Seed-data assessment:
1. Seed does not set ``service_instances.slug`` — no seed change.
2. Targets only NULL/empty; no NOT NULL until 0049.
3. N/A.
4. N/A.
5. N/A.
6. N/A.

Downgrade is intentionally non-destructive (same as 0043).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0048_inst_slug_backfill_consult"
down_revision = "0047_orgs_slug_to_partner_key"
branch_labels = None
depends_on = None

_CREATE_SLUGIFY_FN_SQL = r"""
CREATE OR REPLACE FUNCTION migration_0048_slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $slugfn$
  SELECT trim(
    both '-'
    FROM regexp_replace(
      substring(
        trim(
          both '-'
          FROM regexp_replace(
            lower(coalesce(input, '')),
            '[^a-z0-9]+',
            '-',
            'g'
          )
        )
        FROM 1 FOR 128
      ),
      '-+$',
      ''
    )
  );
$slugfn$
"""

_BACKFILL_UPDATE_SQL = r"""
WITH base_rows AS (
  SELECT
    si.id,
    si.title AS si_title,
    si.created_at
  FROM service_instances AS si
  WHERE si.slug IS NULL OR trim(coalesce(si.slug, '')) = ''
),
computed AS (
  SELECT
    b.id,
    CASE
      WHEN migration_0048_slugify(trim(coalesce(b.si_title, ''))) != ''
      THEN
        migration_0048_slugify(trim(coalesce(b.si_title, '')))
        || '-'
        || substring(replace(b.id::text, '-', ''), 1, 8)
      ELSE
        'consultation-' || substring(replace(b.id::text, '-', ''), 1, 8)
    END AS raw_candidate
  FROM base_rows AS b
),
candidates AS (
  SELECT
    c.id,
    CASE
      WHEN migration_0048_slugify(c.raw_candidate) = ''
      THEN 'instance-' || substring(replace(c.id::text, '-', ''), 1, 8)
      ELSE migration_0048_slugify(c.raw_candidate)
    END AS base
  FROM computed AS c
),
ranked AS (
  SELECT
    cand.id,
    cand.base,
    row_number() OVER (PARTITION BY lower(cand.base) ORDER BY cand.id) AS within_batch_rn,
    (
      SELECT count(*)::int
      FROM service_instances AS x
      WHERE x.slug IS NOT NULL
        AND trim(coalesce(x.slug, '')) != ''
        AND lower(x.slug) = lower(cand.base)
    ) AS existing_count
  FROM candidates AS cand
),
final_slugs AS (
  SELECT
    r.id,
    CASE
      WHEN r.within_batch_rn = 1 AND r.existing_count = 0
      THEN r.base
      ELSE
        substring(
          r.base || '-' || (r.within_batch_rn + r.existing_count)::text
          FROM 1 FOR 128
        )
    END AS final_slug
  FROM ranked AS r
)
UPDATE service_instances AS si
SET slug = fs.final_slug
FROM final_slugs AS fs
WHERE si.id = fs.id
"""

_DROP_SLUGIFY_FN_SQL = "DROP FUNCTION IF EXISTS migration_0048_slugify(text)"

_ASSERT_NO_NULL_SQL = r"""
DO $assert1$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM service_instances AS si
    WHERE si.slug IS NULL OR trim(coalesce(si.slug, '')) = ''
  ) THEN
    RAISE EXCEPTION '0048 backfill incomplete: NULL/empty service_instances.slug remain';
  END IF;
END
$assert1$
"""


def upgrade() -> None:
    op.execute(sa.text(_CREATE_SLUGIFY_FN_SQL))
    op.execute(sa.text(_BACKFILL_UPDATE_SQL))
    op.execute(sa.text(_DROP_SLUGIFY_FN_SQL))
    op.execute(sa.text(_ASSERT_NO_NULL_SQL))


def downgrade() -> None:
    print(
        "0048_inst_slug_backfill_consult: downgrade is a no-op; "
        "backfilled slugs are not safely reversible"
    )
