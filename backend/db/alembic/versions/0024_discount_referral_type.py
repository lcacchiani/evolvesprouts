"""Add referral value to discount_type enum and relax value check for referral rows.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - No discount_codes seed rows exist in `backend/db/seed/seed_data.sql`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - No new columns; CHECK constraint is replaced (referral allows discount_value >= 0).
3. Renamed/dropped columns reflected in seed data:
   - None.
4. New tables evaluated for seed rows:
   - None.
5. Enum/allowed-value changes validated in seed rows:
   - Additive enum value `referral`; existing rows unchanged.
6. FK/cascade changes validated for insert order and references:
   - None.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0024_discount_referral_type"
down_revision: Union[str, None] = "0023_services_add_slug"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'referral'")
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
    # PostgreSQL enum value removals are intentionally not attempted.
