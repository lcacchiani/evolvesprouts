"""Tighten ``customer_invoices`` bill-to CHECK for exclusive FK columns.

Replaces ``customer_invoices_bill_to_one_chk`` so issued rows cannot mix
multiple bill-to FKs; draft rows remain unconstrained on FK presence.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: no seed inserts into ``customer_invoices``.
2. NOT NULL: unchanged.
3. N/A.
4. N/A.
5. N/A.
6. N/A.

Result: No seed updates required.

Revision id length: 26 chars (<= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0056_tighten_invoice_billto"
down_revision: Union[str, None] = "0055_customer_billing_ar"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE customer_invoices DROP CONSTRAINT IF EXISTS customer_invoices_bill_to_one_chk"
    )
    op.execute(
        """
        ALTER TABLE customer_invoices ADD CONSTRAINT customer_invoices_bill_to_one_chk CHECK (
            status = 'draft'
            OR (
                bill_to_kind = 'contact'
                AND bill_to_contact_id IS NOT NULL
                AND bill_to_family_id IS NULL
                AND bill_to_organization_id IS NULL
            )
            OR (
                bill_to_kind = 'family'
                AND bill_to_family_id IS NOT NULL
                AND bill_to_contact_id IS NULL
                AND bill_to_organization_id IS NULL
            )
            OR (
                bill_to_kind = 'organization'
                AND bill_to_organization_id IS NOT NULL
                AND bill_to_contact_id IS NULL
                AND bill_to_family_id IS NULL
            )
        )
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE customer_invoices DROP CONSTRAINT IF EXISTS customer_invoices_bill_to_one_chk"
    )
    op.execute(
        """
        ALTER TABLE customer_invoices ADD CONSTRAINT customer_invoices_bill_to_one_chk CHECK (
            (bill_to_kind = 'contact' AND bill_to_contact_id IS NOT NULL)
            OR (bill_to_kind = 'family' AND bill_to_family_id IS NOT NULL)
            OR (bill_to_kind = 'organization' AND bill_to_organization_id IS NOT NULL)
            OR status = 'draft'
        )
        """
    )
