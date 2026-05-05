"""Partial unique index on intro-call instance session start times.

PostgreSQL 12+ supports ``ALTER TYPE ... ADD VALUE`` inside a transaction
(see migration ``0059_intro_call_service_type``); this migration assumes PG 12+.

Race protection: two concurrent intro-call bookings for the same ``starts_at``
on the shared ``intro-call-free-15min`` instance must not both commit; the
application maps ``IntegrityError`` on flush to ``409 slot_unavailable``.

Revision id length: 27 chars (<= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0060_intro_call_starts_uniq"
down_revision: Union[str, None] = "0059_intro_call_service_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "instance_session_slots_intro_call_starts_unique",
        "instance_session_slots",
        ["starts_at"],
        unique=True,
        postgresql_where=sa.text(
            "instance_id = (SELECT id FROM service_instances WHERE slug = 'intro-call-free-15min')"
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "instance_session_slots_intro_call_starts_unique",
        table_name="instance_session_slots",
    )
