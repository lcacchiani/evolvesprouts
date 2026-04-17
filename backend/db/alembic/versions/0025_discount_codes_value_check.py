"""Replace discount_codes positive-value CHECK after referral enum exists.

Depends on `0024_discount_referral_add_enum` so the `referral` label is visible
in a later transaction before this CHECK references it.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - No discount_codes seed rows exist in `backend/db/seed/seed_data.sql`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - CHECK replaced only; referral allows discount_value >= 0.
3. Renamed/dropped columns reflected in seed data:
   - None.
4. New tables evaluated for seed rows:
   - None.
5. Enum/allowed-value changes validated in seed rows:
   - Uses existing `referral` enum member from prior revision.
6. FK/cascade changes validated for insert order and references:
   - None.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0025_discount_codes_value_check"
down_revision: Union[str, None] = "0024_discount_referral_add_enum"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "discount_codes_positive_value",
        "discount_codes",
        type_="check",
    )
    op.create_check_constraint(
        "discount_codes_value_by_type",
        "discount_codes",
        "(discount_type = 'referral' AND discount_value >= 0) "
        "OR (discount_type <> 'referral' AND discount_value > 0)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "discount_codes_value_by_type",
        "discount_codes",
        type_="check",
    )
    op.create_check_constraint(
        "discount_codes_positive_value",
        "discount_codes",
        "discount_value > 0",
    )
