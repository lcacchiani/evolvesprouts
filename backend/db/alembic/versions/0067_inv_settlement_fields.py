"""Add derived invoice settlement columns (allocations projection).

Adds ``amount_allocated``, ``balance_due``, and ``paid_at`` on ``customer_invoices``,
maintained transactionally from ``payment_allocations`` (same-currency rows only).

Backfill:
- ``amount_allocated`` / ``balance_due`` from summed allocations joined on matching currency.
- ``paid_at`` is set to ``updated_at`` for issued rows that are fully covered
  (``balance_due = 0`` and ``amount_allocated > 0``) as a **best-effort** historical
  timestamp (true settlement time was not recorded).

Partial index ``customer_invoices_open_idx`` supports listing open issued invoices
by ``due_date``.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: seed file does not insert ``customer_invoices`` rows.
2. N/A (no seed invoice rows).
3. N/A.
4. N/A.
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id: ``0067_inv_settlement_fields`` (26 chars, <= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0067_inv_settlement_fields"
down_revision: Union[str, None] = "0066_cp_enroll_extref_uq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customer_invoices",
        sa.Column(
            "amount_allocated",
            sa.Numeric(14, 4),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "customer_invoices",
        sa.Column(
            "balance_due",
            sa.Numeric(14, 4),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "customer_invoices",
        sa.Column(
            "paid_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )

    op.execute(
        sa.text(
            """
            UPDATE customer_invoices AS ci
            SET
                amount_allocated = agg.total_alloc,
                balance_due = GREATEST(ci.total - agg.total_alloc, 0)
            FROM (
                SELECT
                    pa.invoice_id,
                    SUM(pa.allocated_amount) AS total_alloc
                FROM payment_allocations AS pa
                INNER JOIN customer_invoices AS ci2
                    ON ci2.id = pa.invoice_id
                    AND ci2.currency = pa.currency
                GROUP BY pa.invoice_id
            ) AS agg
            WHERE ci.id = agg.invoice_id
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE customer_invoices
            SET paid_at = updated_at
            WHERE status = 'issued'
              AND balance_due = 0
              AND amount_allocated > 0
            """
        )
    )

    op.create_index(
        "customer_invoices_open_idx",
        "customer_invoices",
        ["due_date"],
        postgresql_where=sa.text("status = 'issued' AND balance_due > 0"),
    )


def downgrade() -> None:
    op.drop_index("customer_invoices_open_idx", table_name="customer_invoices")
    op.drop_column("customer_invoices", "paid_at")
    op.drop_column("customer_invoices", "balance_due")
    op.drop_column("customer_invoices", "amount_allocated")
