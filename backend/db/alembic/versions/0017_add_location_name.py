"""Add optional display name to locations.

Seed-data assessment:
1. Seed does not insert into `locations`; compatible.
2. New column is nullable; no seed impact.
3. N/A
4. N/A
5. N/A
6. N/A

Result: No seed updates required.
"""

from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_add_location_name"
down_revision: Union[str, None] = "0016_del_exp_no_vendor"
branch_labels: Union[str, tuple[str, ...], None] = None
depends_on: Union[str, tuple[str, ...], None] = None


def upgrade() -> None:
    op.add_column(
        "locations",
        sa.Column(
            "name",
            sa.Text(),
            nullable=True,
            comment="Display label for the venue/location",
        ),
    )


def downgrade() -> None:
    op.drop_column("locations", "name")
