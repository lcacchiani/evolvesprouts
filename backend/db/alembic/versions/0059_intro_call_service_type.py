"""Add ``intro_call`` label to ``service_type`` enum.

PostgreSQL does not support removing enum values cleanly; rollback would
require recreating the enum and rewriting columns. Downgrade is a no-op.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: additive seed blocks for intro-call service depend on this value.
2. N/A (enum label only).
3. N/A.
4. N/A.
5. Additive enum value ``intro_call``; seed inserts use it after upgrade.
6. N/A.

Revision id length: 28 chars (<= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0059_intro_call_service_type"
down_revision: Union[str, None] = "0058_inv_line_null_enrollment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'intro_call'")


def downgrade() -> None:
    # PostgreSQL enum value removals are intentionally not attempted.
    return None
