"""Add vendor reference column to expenses.

Seed-data assessment:
1. Compatibility with existing seed SQL:
   - `backend/db/seed/seed_data.sql` remains compatible because the new column is nullable.
2. New NOT NULL/CHECK-constrained columns handled in seed data:
   - No new NOT NULL/CHECK-constrained columns are introduced.
3. Renamed/dropped columns reflected in seed data:
   - No columns are renamed or dropped.
4. New tables evaluated for seed rows:
   - No new tables are introduced.
5. Enum/allowed-value changes validated in seed rows:
   - No enum or allowed-value changes are introduced.
6. FK/cascade changes validated for insert order and references:
   - The nullable FK points to existing `organizations` records and does not affect seed insert order.

Result: No seed updates are required for this migration.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0012_add_expense_vendor_id"
down_revision: Union[str, None] = "0011_add_expenses"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add vendor_id FK to expenses."""
    op.add_column(
        "expenses",
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "expenses_vendor_id_fkey",
        "expenses",
        "organizations",
        ["vendor_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("expenses_vendor_idx", "expenses", ["vendor_id"])


def downgrade() -> None:
    """Drop vendor_id FK from expenses."""
    op.drop_index("expenses_vendor_idx", table_name="expenses")
    op.drop_constraint("expenses_vendor_id_fkey", "expenses", type_="foreignkey")
    op.drop_column("expenses", "vendor_id")
