"""Add display-only ``capacity_left_override`` on ``service_instances``.

Adds nullable non-negative ``capacity_left_override`` for a soft cap on how many
spots remain are shown publicly (folded into ``spaces_left``). Booking guards and
``InstanceStatus.FULL`` reconciliation continue to use ``max_capacity`` vs enrollment
counts only.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: column is nullable with no default.
2. N/A (no new NOT NULL columns).
3. N/A.
4. N/A (no new required seed rows).
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id: ``0068_inst_capacity_left_override`` (32 chars, <= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0068_inst_capacity_left_override"
down_revision: Union[str, None] = "0067_inv_settlement_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "service_instances",
        sa.Column("capacity_left_override", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "service_instances_capacity_left_override_nonneg",
        "service_instances",
        "capacity_left_override IS NULL OR capacity_left_override >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "service_instances_capacity_left_override_nonneg",
        "service_instances",
        type_="check",
    )
    op.drop_column("service_instances", "capacity_left_override")
