"""Drop Calendly URL columns from consultation service and instance details.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatibility: seed does not reference ``calendly_url`` / ``calendly_event_url``; no seed update required.
2. NOT NULL: N/A (dropped columns were nullable).
3. Renamed/dropped: columns removed; seed unaffected.
4. New tables: N/A.
5. Enum: N/A.
6. FK order: N/A.

**Irreversible data:** Upgrade permanently drops stored Calendly URLs. Downgrade re-adds
the columns as NULL; previous values cannot be recovered.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0034_drop_calendly_fields"
down_revision: Union[str, None] = "0033_phone_region"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("consultation_details", "calendly_url")
    op.drop_column("consultation_instance_details", "calendly_event_url")


def downgrade() -> None:
    op.add_column(
        "consultation_details",
        sa.Column("calendly_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "consultation_instance_details",
        sa.Column("calendly_event_url", sa.String(length=500), nullable=True),
    )
