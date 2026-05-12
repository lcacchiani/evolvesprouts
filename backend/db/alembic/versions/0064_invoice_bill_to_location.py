"""Add bill_to_location_text on customer invoices.

Snapshot of venue/address lines for the resolved bill-to party (contact,
family + primary contact fallback, or organization) for PDF rendering.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: no seed inserts into ``customer_invoices``.
2. NOT NULL: new column is nullable; no seed updates required.
3. N/A.
4. N/A.
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id: ``0064_invoice_bill_to_location`` (28 chars, <= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0064_invoice_bill_to_location"
down_revision: Union[str, None] = "0063_tier_per_service"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customer_invoices",
        sa.Column("bill_to_location_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("customer_invoices", "bill_to_location_text")
