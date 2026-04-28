"""Partial unique index: one enrollment per contact per instance when contact set.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatibility: seed has no ``enrollments`` inserts.
2. NOT NULL: index only applies where ``contact_id`` IS NOT NULL; no seed rows.
3. Renamed/dropped: none.
4. New tables: none.
5. Enum/allowed-value changes: none.
6. FK/cascade changes: none.

Upgrade fails if duplicate (instance_id, contact_id) pairs exist with non-null
contact_id; resolve data before applying.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0045_enrollment_inst_contact_uidx"
down_revision: Union[str, None] = "0044_drop_landing_page"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX enrollments_instance_contact_uidx
            ON enrollments (instance_id, contact_id)
            WHERE contact_id IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS enrollments_instance_contact_uidx"))
