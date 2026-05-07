"""Add ``skipped`` to ``eventbrite_sync_status`` enum.

Consultation and intro-call per-booking instances use ``skipped`` instead of
``pending`` so Eventbrite sync lists (event-type only) stay meaningful.

Split into its own revision so the enum value exists before application code
references it.

Revision id: ``0062_eventbrite_skipped`` (24 chars, <= 32).

Seed audit: no ``seed_data.sql`` row changes required.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0062_eventbrite_skipped"
down_revision: Union[str, None] = "0061_per_booking_instances"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE eventbrite_sync_status ADD VALUE IF NOT EXISTS 'skipped'")


def downgrade() -> None:
    # PostgreSQL cannot remove individual enum labels without recreating the type.
    # After downgrade, the ``skipped`` label remains in ``eventbrite_sync_status``
    # until a manual type rebuild is performed.
    pass
