"""Partial unique index: one inbound payment per enrollment + external_reference.

Prevents duplicate manual payment rows when the same bank reference is submitted twice.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: no seed rows rely on duplicate (enrollment_id, external_reference) pairs.
2. N/A for NOT NULL changes.
3. N/A.
4. No seed inserts into ``customer_payments`` with conflicting external_reference per enrollment.
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id: ``0066_cp_enroll_extref_uq`` (24 chars, <= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0066_cp_enroll_extref_uq"
down_revision: Union[str, None] = "0065_bulk_import_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_cp_enrollment_external_ref",
        "customer_payments",
        ["enrollment_id", "external_reference"],
        unique=True,
        postgresql_where=sa.text("external_reference IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_cp_enrollment_external_ref", table_name="customer_payments")
