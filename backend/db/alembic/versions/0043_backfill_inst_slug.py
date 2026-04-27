"""Backfill ``service_instances.slug`` for event and training_course rows.

Fills NULL slugs using deterministic rules (MBA cohorts, event title + first
slot date, other training course service slug + cohort/title). Resolves
collisions with numeric suffixes ``-2``, ``-3``, … (case-insensitive uniqueness)
in a single statement using window functions and a count of pre-existing slugs.

Seed-data assessment:
1. Compatible: seed only sets ``services.slug``; ``service_instances.slug`` is
   untouched by seed.
2. NOT NULL: column stays nullable; backfill targets rows where ``slug`` is
   NULL or blank (``trim`` empty) for ``event`` and ``training_course`` services.
3. Renamed/dropped columns: none.
4. New tables: none. Earlier draft used a temp table; replaced with a single
   ``UPDATE … FROM (CTE)`` because temp tables with ``ON COMMIT DROP`` did not
   survive across separate ``op.execute(sa.text(...))`` calls reliably under
   SQLAlchemy 2.x + psycopg3 (each ``op.execute`` may flush state in a way that
   triggers the drop), leaving the backfill silently a no-op.
5. Enum/allowed-value changes: none.
6. FK/cascade changes: none.

Downgrade is intentionally non-destructive: backfilled values are not safely
reversible without losing public URLs. ``downgrade()`` prints a one-line message
to stdout (for tests and deploy logs); it does not alter data.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0043_backfill_inst_slug"
down_revision = "0042_slug_nulls_nd"
branch_labels = None
depends_on = None

# Each module-level constant is exactly one top-level SQL statement so each
# ``op.execute(sa.text(...))`` call sends a single statement under psycopg3's
# extended-query protocol. Order matches the production ``upgrade()`` body.

_CREATE_SLUGIFY_FN_SQL = r"""
CREATE OR REPLACE FUNCTION migration_0043_slugify(input text)
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

# Single-statement backfill. Computes a base candidate per target row, dedupes
# via window function within the backfill batch, and adds an offset for any
# pre-existing populated slugs that collide on lowercase. Final slug shape:
#   base                              when first occurrence in batch + no DB collision
#   base-<rn>                         when 2nd+ occurrence in batch + no DB collision
#   base-<rn + existing_count>        when at least one DB row already uses ``base``
#
# ``existing_count`` is the number of populated rows whose lowercased slug equals
# the base candidate; the unique partial index ``svc_instances_slug_uq`` would
# fail an UPDATE that produced a duplicate, so a residual ``base-N`` collision
# against an existing ``base-N`` (extremely rare) surfaces as a deploy error.
_BACKFILL_UPDATE_SQL = r"""
WITH first_slot AS (
  SELECT DISTINCT ON (iss.instance_id)
    iss.instance_id,
    iss.starts_at
  FROM instance_session_slots AS iss
  ORDER BY iss.instance_id, iss.sort_order ASC, iss.starts_at ASC
),
base_rows AS (
  SELECT
    si.id,
    si.title AS si_title,
    si.cohort AS si_cohort,
    si.created_at,
    s.service_type::text AS stype,
    lower(trim(coalesce(s.slug, ''))) AS s_slug,
    s.title AS s_title,
    s.service_tier,
    fs.starts_at AS first_starts_at
  FROM service_instances AS si
  INNER JOIN services AS s ON s.id = si.service_id
  LEFT JOIN first_slot AS fs ON fs.instance_id = si.id
  WHERE s.service_type IN ('event', 'training_course')
    AND (si.slug IS NULL OR trim(si.slug) = '')
),
computed AS (
  SELECT
    b.id,
    CASE
      WHEN b.stype = 'training_course'
        AND b.s_slug = 'my-best-auntie'
        AND nullif(trim(coalesce(b.service_tier, substring(b.si_title FROM '(\d+-\d+)'), '')), '')
          IS NOT NULL
        AND nullif(
          trim(
            coalesce(
              b.si_cohort,
              regexp_replace(
                substring(lower(coalesce(b.si_title, '')) FROM '([a-z]{3}\s*\d{2,4})$'),
                '\s+',
                '-',
                'g'
              ),
              substring(b.si_title FROM '(\d{2}-\d{2})$'),
              ''
            )
          ),
          ''
        ) IS NOT NULL
      THEN
        migration_0043_slugify(
          'my-best-auntie-'
          || trim(coalesce(b.service_tier, substring(b.si_title FROM '(\d+-\d+)'), ''))
          || '-'
          || trim(
            coalesce(
              b.si_cohort,
              regexp_replace(
                substring(lower(coalesce(b.si_title, '')) FROM '([a-z]{3}\s*\d{2,4})$'),
                '\s+',
                '-',
                'g'
              ),
              substring(b.si_title FROM '(\d{2}-\d{2})$'),
              ''
            )
          )
        )
      WHEN b.stype = 'training_course'
      THEN
        CASE
          WHEN migration_0043_slugify(trim(coalesce(b.si_cohort, b.si_title, ''))) = ''
          THEN migration_0043_slugify(b.s_title)
          ELSE
            trim(
              both '-'
              FROM concat_ws(
                '-',
                nullif(
                  migration_0043_slugify(
                    coalesce(nullif(b.s_slug, ''), b.s_title)
                  ),
                  ''
                ),
                migration_0043_slugify(trim(coalesce(b.si_cohort, b.si_title, '')))
              )
            )
        END
      WHEN b.stype = 'event'
      THEN
        migration_0043_slugify(trim(coalesce(b.si_title, b.s_title)))
        || '-'
        || coalesce(
          to_char(b.first_starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
          to_char(b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        )
      ELSE migration_0043_slugify('')
    END AS raw_candidate
  FROM base_rows AS b
),
candidates AS (
  SELECT
    c.id,
    CASE
      WHEN migration_0043_slugify(c.raw_candidate) = ''
      THEN 'instance-' || substring(replace(c.id::text, '-', ''), 1, 8)
      ELSE migration_0043_slugify(c.raw_candidate)
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

_DROP_SLUGIFY_FN_SQL = "DROP FUNCTION IF EXISTS migration_0043_slugify(text)"

_ASSERT_NO_NULL_SLUGS_SQL = r"""
DO $assert1$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM service_instances AS si
    INNER JOIN services AS s ON s.id = si.service_id
    WHERE s.service_type IN ('event', 'training_course')
      AND (si.slug IS NULL OR trim(coalesce(si.slug, '')) = '')
  ) THEN
    RAISE EXCEPTION 'Backfill incomplete: event/training_course instances with NULL/empty slug remain';
  END IF;
END
$assert1$
"""

_ASSERT_VALID_SLUG_SHAPE_SQL = r"""
DO $assert2$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM service_instances
    WHERE slug IS NOT NULL
      AND slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ) THEN
    RAISE EXCEPTION 'Migration produced invalid slug shape; aborting';
  END IF;
END
$assert2$
"""


def upgrade() -> None:
    op.execute(sa.text(_CREATE_SLUGIFY_FN_SQL))
    op.execute(sa.text(_BACKFILL_UPDATE_SQL))
    op.execute(sa.text(_DROP_SLUGIFY_FN_SQL))
    op.execute(sa.text(_ASSERT_NO_NULL_SLUGS_SQL))
    op.execute(sa.text(_ASSERT_VALID_SLUG_SHAPE_SQL))


def downgrade() -> None:
    print(
        "0043_backfill_inst_slug: downgrade is a no-op; backfilled slugs are not safely reversible"
    )
