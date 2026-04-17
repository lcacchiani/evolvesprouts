"""Add referral label to discount_type enum (committed before CHECK may reference it).

PostgreSQL requires new enum values to be committed before use in the same
database session. Adding `referral` and replacing the discount_codes CHECK in
one Alembic transaction fails with "unsafe use of new value ... referral".
This revision only adds the enum value; see `0025_discount_codes_value_check`.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - No discount_codes seed rows exist in `backend/db/seed/seed_data.sql`.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - None (enum label only).
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

revision: str = "0024_discount_referral_add_enum"
down_revision: Union[str, None] = "0023_services_add_slug"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'referral'")


def downgrade() -> None:
    # PostgreSQL enum value removals are intentionally not attempted.
    return None
