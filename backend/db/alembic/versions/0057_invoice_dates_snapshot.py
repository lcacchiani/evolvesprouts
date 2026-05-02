"""Add ``invoice_date`` / ``due_date`` snapshot columns to ``customer_invoices``.

Nullable DATE columns store the calendar invoice date and due date at issuance
(in ``INVOICE_DISPLAY_TIMEZONE``), separate from ``issued_at`` (UTC instant).

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: no seed inserts into ``customer_invoices``.
2. NOT NULL: new columns are nullable; no seed updates required.
3. N/A.
4. N/A.
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id length: 26 chars (<= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0057_invoice_dates_snapshot"
down_revision: Union[str, None] = "0056_tighten_invoice_billto"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customer_invoices",
        sa.Column("invoice_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "customer_invoices",
        sa.Column("due_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("customer_invoices", "due_date")
    op.drop_column("customer_invoices", "invoice_date")
