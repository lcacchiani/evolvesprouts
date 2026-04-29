"""Correct legacy MBA ``services.service_key`` from ``my-best-auntie`` to canonical key.

Environments seeded before the public-site constant alignment could keep
``service_key = 'my-best-auntie'`` because seed only targets NULL keys.
This migration is idempotent and scoped to the known legacy value plus title heuristics.

Seed-data assessment:
1. Seed compatibility: seed already targets ``my-best-auntie-training-course``; this
   migration only fixes rows that slipped through with the old key.
2. NOT NULL: unchanged.
3. N/A.
4. N/A.
5. N/A.
6. N/A.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0050_fix_mba_service_key"
down_revision: Union[str, None] = "0049_inst_slug_not_null"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UPGRADE_SQL = """
UPDATE services AS s
SET service_key = 'my-best-auntie-training-course'
WHERE lower(trim(coalesce(s.service_key, ''))) = 'my-best-auntie'
  AND s.service_type = 'training_course'
  AND (
    lower(coalesce(s.title, '')) LIKE '%best auntie%'
    OR lower(coalesce(s.title, '')) LIKE '%my best auntie%'
  )
"""

_DOWNGRADE_SQL = """
UPDATE services AS s
SET service_key = 'my-best-auntie'
WHERE lower(trim(coalesce(s.service_key, ''))) = 'my-best-auntie-training-course'
  AND s.service_type = 'training_course'
  AND (
    lower(coalesce(s.title, '')) LIKE '%best auntie%'
    OR lower(coalesce(s.title, '')) LIKE '%my best auntie%'
  )
"""


def upgrade() -> None:
    op.execute(sa.text(_UPGRADE_SQL))


def downgrade() -> None:
    op.execute(sa.text(_DOWNGRADE_SQL))
