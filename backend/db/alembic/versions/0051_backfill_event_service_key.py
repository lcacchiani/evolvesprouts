"""Backfill ``services.service_key`` for event and training_course rows without a key.

Slugifies ``title`` to a kebab-case key (max 80 chars), disambiguates collisions on
``(lower(service_key), lower(service_tier))`` with numeric suffixes, and uses a
deterministic fallback when the title slugifies to empty.

Post-upgrade: every **published** ``event`` / ``training_course`` must have a
non-blank ``service_key`` (raises if not). Draft/archived rows may remain without
a key.

Seed-data assessment:
1. Seed compatibility: seed updates that set ``service_key`` remain valid; this
   migration only fills NULL/blank keys on event and training_course rows.
2. NOT NULL: unchanged (column stays nullable for non-published types).
3. N/A.
4. N/A.
5. N/A.
6. Unique index ``services_service_key_tier_unique_idx``: suffix logic avoids
   collisions within the batch; conflicts with pre-existing keys increment the
   suffix via ``existing`` count.

Downgrade is intentionally a no-op (forward-only data fix).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0051_backfill_event_service_key"
down_revision: Union[str, None] = "0050_fix_mba_service_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CREATE_FN = r"""
CREATE OR REPLACE FUNCTION migration_0051_slugify(input text)
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
        FROM 1 FOR 80
      ),
      '-+$',
      ''
    )
  );
$slugfn$
"""

_BACKFILL = r"""
WITH base AS (
  SELECT
    s.id,
    s.service_tier,
    CASE
      WHEN migration_0051_slugify(s.title) = ''
      THEN
        substring(
          'event-' || substring(replace(s.id::text, '-', ''), 1, 8)
          FROM 1 FOR 80
        )
      ELSE migration_0051_slugify(s.title)
    END AS cand
  FROM services AS s
  WHERE s.service_type IN ('event', 'training_course')
    AND (s.service_key IS NULL OR trim(s.service_key) = '')
),
ranked AS (
  SELECT
    b.id,
    b.cand,
    row_number() OVER (
      PARTITION BY lower(b.cand), lower(coalesce(b.service_tier, ''))
      ORDER BY b.id
    ) AS rn,
    (
      SELECT count(*)::int
      FROM services AS x
      WHERE x.service_key IS NOT NULL
        AND trim(x.service_key) <> ''
        AND lower(trim(x.service_key)) = lower(trim(b.cand))
        AND coalesce(lower(trim(x.service_tier)), '') = coalesce(lower(trim(b.service_tier)), '')
    ) AS existing
  FROM base AS b
)
UPDATE services AS s
SET service_key = CASE
  WHEN r.rn = 1 AND r.existing = 0 THEN substring(r.cand FROM 1 FOR 80)
  ELSE substring(r.cand || '-' || (r.rn + r.existing)::text FROM 1 FOR 80)
END
FROM ranked AS r
WHERE s.id = r.id
"""

_DROP_FN = "DROP FUNCTION IF EXISTS migration_0051_slugify(text)"

_ASSERT = r"""
DO $assert$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM services
    WHERE service_type IN ('event', 'training_course')
      AND status = 'published'
      AND (service_key IS NULL OR trim(service_key) = '')
  ) THEN
    RAISE EXCEPTION 'Backfill incomplete: published event/training_course rows still have no service_key';
  END IF;
END
$assert$
"""


def upgrade() -> None:
    op.execute(sa.text(_CREATE_FN))
    op.execute(sa.text(_BACKFILL))
    op.execute(sa.text(_DROP_FN))
    op.execute(sa.text(_ASSERT))


def downgrade() -> None:
    print(
        "0051_backfill_event_service_key: downgrade is a no-op; "
        "backfilled service_key values are not reverted"
    )
