"""Allow ``customer_invoice_lines.enrollment_id`` to be NULL.

Customized draft invoices can carry lines that are not tied to an enrollment.
Enrollment-linked lines keep ``enrollment_id`` set and retain ``ON DELETE RESTRICT``.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: no seed inserts into ``customer_invoice_lines``.
2. NOT NULL removed only on ``enrollment_id``; other columns unchanged.
3. N/A.
4. N/A.
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id length: 32 chars (<= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0058_invoice_line_null_enrollment"
down_revision: Union[str, None] = "0057_invoice_dates_snapshot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "customer_invoice_lines",
        "enrollment_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("DELETE FROM customer_invoice_lines WHERE enrollment_id IS NULL")
    op.alter_column(
        "customer_invoice_lines",
        "enrollment_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )
