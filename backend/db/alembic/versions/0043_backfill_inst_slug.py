"""Backfill ``service_instances.slug`` for event and training_course rows.

Fills NULL slugs using deterministic rules (MBA cohorts, event title + first
slot date, other training course service slug + cohort/title). Resolves
collisions with numeric suffixes ``-2``, ``-3``, … (case-insensitive uniqueness).

Seed-data assessment:
1. Compatible: seed only sets ``services.slug``; ``service_instances.slug`` is
   untouched by seed.
2. NOT NULL: column stays nullable; backfill targets rows where ``slug`` is
   NULL or blank (``trim`` empty) for ``event`` and ``training_course`` services.
3. Renamed/dropped columns: none.
4. New tables: none (uses session-local temp table inside DO block).
5. Enum/allowed-value changes: none.
6. FK/cascade changes: none.

Downgrade is intentionally non-destructive: backfilled values are not safely
reversible without losing public URLs.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0043_backfill_inst_slug"
down_revision = "0042_slug_nulls_nd"
branch_labels = None
depends_on = None

_UPGRADE_SQL = r"""
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
$slugfn$;

CREATE TEMP TABLE tmp_0043_slug_candidates (
  id uuid PRIMARY KEY,
  base_candidate text NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_0043_slug_candidates (id, base_candidate)
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
    si.service_id,
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
)
SELECT
  c.id,
  CASE
    WHEN migration_0043_slugify(c.raw_candidate) = ''
    THEN 'instance-' || substring(replace(c.id::text, '-', ''), 1, 8)
    ELSE migration_0043_slugify(c.raw_candidate)
  END
FROM computed AS c;

DO $collision$
DECLARE
  iter int := 0;
  assigned int;
BEGIN
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM service_instances AS si
      INNER JOIN tmp_0043_slug_candidates AS t ON t.id = si.id
      WHERE si.slug IS NULL OR trim(si.slug) = ''
    ) THEN
      EXIT;
    END IF;

    iter := iter + 1;
    IF iter > 100 THEN
      RAISE EXCEPTION 'Backfill slug collision resolution exceeded 100 levels';
    END IF;

    WITH proposed AS (
      SELECT
        si.id,
        trim(
          both '-'
          FROM regexp_replace(
            substring(
              trim(
                both '-'
                FROM (t.base_candidate || CASE WHEN iter = 1 THEN '' ELSE '-' || iter::text END)
              )
              FROM 1 FOR 128
            ),
            '-+$',
            ''
          )
        ) AS final_slug
      FROM service_instances AS si
      INNER JOIN tmp_0043_slug_candidates AS t ON t.id = si.id
      WHERE si.slug IS NULL OR trim(si.slug) = ''
    ),
    ranked AS (
      SELECT
        id,
        final_slug,
        row_number() OVER (PARTITION BY lower(final_slug) ORDER BY id) AS rn
      FROM proposed
    ),
    winners AS (
      SELECT r.id, r.final_slug
      FROM ranked AS r
      WHERE r.rn = 1
        AND NOT EXISTS (
          SELECT 1
          FROM service_instances AS x
          WHERE x.slug IS NOT NULL
            AND lower(x.slug) = lower(r.final_slug)
        )
    )
    UPDATE service_instances AS si
    SET slug = w.final_slug
    FROM winners AS w
    WHERE si.id = w.id;

    GET DIAGNOSTICS assigned = ROW_COUNT;
    IF assigned = 0 THEN
      RAISE EXCEPTION 'Backfill deadlock: no progress assigning slugs at iteration %', iter;
    END IF;
  END LOOP;
END
$collision$;

DROP FUNCTION IF EXISTS migration_0043_slugify(text);

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
$assert1$;

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
$assert2$;
"""


def upgrade() -> None:
    op.execute(sa.text(_UPGRADE_SQL))


def downgrade() -> None:
    op.execute(
        sa.text(
            "DO $dn$ BEGIN "
            "RAISE NOTICE 'Downgrade is a no-op: backfilled slugs are not safely reversible'; "
            "END $dn$;"
        )
    )
