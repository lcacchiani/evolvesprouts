"""Unique (instance_id, starts_at) on session slots.

PostgreSQL rejects subqueries in partial-index predicates, so we enforce
uniqueness with a composite unique index instead of
``WHERE instance_id = (SELECT ...)``.

Race protection for intro-call (and any instance): two rows for the same
instance cannot share the same ``starts_at``. The application maps
``IntegrityError`` on flush to ``409 slot_unavailable``.

Revision id length: 27 chars (<= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0060_intro_call_starts_uniq"
down_revision: Union[str, None] = "0059_intro_call_service_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "instance_session_slots_instance_starts_uidx",
        "instance_session_slots",
        ["instance_id", "starts_at"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "instance_session_slots_instance_starts_uidx",
        table_name="instance_session_slots",
    )
