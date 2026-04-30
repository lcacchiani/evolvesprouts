"""Customer billing (AR): tables, counters, enrollment bill-to, audit triggers.

Adds customer payment/allocation/invoice/receipt tables, ``document_counters``,
enrollment billing columns, and attaches ``audit_trigger_func()`` (from
``0054_add_audit_log``) to the five billing tables. Does **not** create
``audit_log`` or replace ``audit_trigger_func()``.

Seed-data assessment (``backend/db/seed/seed_data.sql``):
1. Compatible: new nullable columns on enrollments; no seed enrollments required.
2. NOT NULL: none added without defaults on existing rows beyond nullable bill-to.
3. N/A for dropped columns.
4. New tables start empty.
5. N/A.
6. FK order: contacts/families/organizations exist before enrollments reference bill-to.

Revision id length: 22 chars (<= 32).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0055_customer_billing_ar"
down_revision: Union[str, None] = "0054_add_audit_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BILLING_AUDITED_TABLES: tuple[str, ...] = (
    "customer_payments",
    "customer_invoices",
    "customer_invoice_lines",
    "payment_allocations",
    "customer_receipts",
)


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE billing_payment_direction AS ENUM ('inbound', 'refund');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
            """
        )
    )
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE billing_payment_status AS ENUM ('pending', 'succeeded', 'failed');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
            """
        )
    )
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE billing_bill_to_kind AS ENUM ('contact', 'family', 'organization');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
            """
        )
    )
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE billing_invoice_status AS ENUM ('draft', 'issued', 'void');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TABLE document_counters (
                document_type TEXT NOT NULL,
                scope_key TEXT NOT NULL DEFAULT 'default',
                year SMALLINT NOT NULL,
                last_number INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (document_type, scope_key, year)
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER document_counters_set_updated_at
            BEFORE UPDATE ON document_counters
            FOR EACH ROW EXECUTE FUNCTION set_updated_at()
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TABLE customer_payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                direction billing_payment_direction NOT NULL DEFAULT 'inbound',
                status billing_payment_status NOT NULL DEFAULT 'pending',
                method VARCHAR(64) NOT NULL,
                amount NUMERIC(14, 4) NOT NULL,
                currency CHAR(3) NOT NULL,
                original_payment_id UUID REFERENCES customer_payments(id) ON DELETE SET NULL,
                stripe_payment_intent_id VARCHAR(128),
                stripe_refund_id VARCHAR(128),
                external_reference TEXT,
                succeeded_at TIMESTAMPTZ,
                confirmed_by TEXT,
                enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
                contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT customer_payments_amount_positive CHECK (amount >= 0),
                CONSTRAINT customer_payments_stripe_pi_unique UNIQUE (stripe_payment_intent_id),
                CONSTRAINT customer_payments_stripe_refund_unique UNIQUE (stripe_refund_id)
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX customer_payments_original_idx
            ON customer_payments (original_payment_id)
            WHERE original_payment_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX customer_payments_enrollment_idx
            ON customer_payments (enrollment_id)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER customer_payments_set_updated_at
            BEFORE UPDATE ON customer_payments
            FOR EACH ROW EXECUTE FUNCTION set_updated_at()
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TABLE customer_invoices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                status billing_invoice_status NOT NULL DEFAULT 'draft',
                invoice_number TEXT,
                invoice_sequence INTEGER,
                currency CHAR(3) NOT NULL,
                subtotal NUMERIC(14, 4) NOT NULL DEFAULT 0,
                tax_total NUMERIC(14, 4) NOT NULL DEFAULT 0,
                total NUMERIC(14, 4) NOT NULL DEFAULT 0,
                bill_to_kind billing_bill_to_kind NOT NULL DEFAULT 'contact',
                bill_to_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
                bill_to_family_id UUID REFERENCES families(id) ON DELETE SET NULL,
                bill_to_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
                bill_to_display_name TEXT,
                bill_to_email TEXT,
                bill_to_snapshot JSONB,
                issued_at TIMESTAMPTZ,
                voided_at TIMESTAMPTZ,
                void_reason TEXT,
                issued_pdf_s3_key TEXT,
                issued_pdf_sha256 CHAR(64),
                pdf_template_version TEXT,
                email_sent_at TIMESTAMPTZ,
                ses_message_id TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT customer_invoices_bill_to_one_chk CHECK (
                    (bill_to_kind = 'contact' AND bill_to_contact_id IS NOT NULL)
                    OR (bill_to_kind = 'family' AND bill_to_family_id IS NOT NULL)
                    OR (bill_to_kind = 'organization' AND bill_to_organization_id IS NOT NULL)
                    OR status = 'draft'
                )
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX customer_invoices_number_unique
            ON customer_invoices (invoice_number)
            WHERE invoice_number IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER customer_invoices_set_updated_at
            BEFORE UPDATE ON customer_invoices
            FOR EACH ROW EXECUTE FUNCTION set_updated_at()
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TABLE customer_invoice_lines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
                enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
                line_order SMALLINT NOT NULL DEFAULT 0,
                description TEXT NOT NULL,
                quantity NUMERIC(14, 4) NOT NULL DEFAULT 1,
                unit_amount NUMERIC(14, 4) NOT NULL,
                line_total NUMERIC(14, 4) NOT NULL,
                discount_amount NUMERIC(14, 4),
                tax_rate NUMERIC(10, 6),
                tax_amount NUMERIC(14, 4),
                currency CHAR(3) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX customer_invoice_lines_invoice_idx
            ON customer_invoice_lines (invoice_id)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER customer_invoice_lines_set_updated_at
            BEFORE UPDATE ON customer_invoice_lines
            FOR EACH ROW EXECUTE FUNCTION set_updated_at()
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TABLE payment_allocations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                payment_id UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
                invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
                invoice_line_id UUID REFERENCES customer_invoice_lines(id) ON DELETE SET NULL,
                allocated_amount NUMERIC(14, 4) NOT NULL,
                currency CHAR(3) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT payment_allocations_positive CHECK (allocated_amount > 0)
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX payment_allocations_payment_idx
            ON payment_allocations (payment_id)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX payment_allocations_invoice_idx
            ON payment_allocations (invoice_id)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER payment_allocations_set_updated_at
            BEFORE UPDATE ON payment_allocations
            FOR EACH ROW EXECUTE FUNCTION set_updated_at()
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE TABLE customer_receipts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_payment_id UUID NOT NULL UNIQUE REFERENCES customer_payments(id) ON DELETE CASCADE,
                receipt_number TEXT NOT NULL,
                receipt_sequence INTEGER NOT NULL,
                currency CHAR(3) NOT NULL,
                total_amount NUMERIC(14, 4) NOT NULL,
                issued_pdf_s3_key TEXT,
                issued_pdf_sha256 CHAR(64),
                pdf_template_version TEXT,
                email_sent_at TIMESTAMPTZ,
                ses_message_id TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX customer_receipts_number_unique
            ON customer_receipts (receipt_number)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER customer_receipts_set_updated_at
            BEFORE UPDATE ON customer_receipts
            FOR EACH ROW EXECUTE FUNCTION set_updated_at()
            """
        )
    )

    op.execute(
        sa.text(
            """
            ALTER TABLE enrollments
            ADD COLUMN IF NOT EXISTS bill_to_kind billing_bill_to_kind,
            ADD COLUMN IF NOT EXISTS bill_to_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS bill_to_family_id UUID REFERENCES families(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS bill_to_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL
            """
        )
    )

    for table_name in BILLING_AUDITED_TABLES:
        op.execute(
            sa.text(
                f"""
            CREATE TRIGGER {table_name}_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON {table_name}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
            """
            )
        )


def downgrade() -> None:
    for table_name in reversed(BILLING_AUDITED_TABLES):
        op.execute(
            sa.text(
                f"DROP TRIGGER IF EXISTS {table_name}_audit_trigger ON {table_name};"
            )
        )

    op.execute(
        sa.text(
            """
            ALTER TABLE enrollments
            DROP COLUMN IF EXISTS bill_to_organization_id,
            DROP COLUMN IF EXISTS bill_to_family_id,
            DROP COLUMN IF EXISTS bill_to_contact_id,
            DROP COLUMN IF EXISTS bill_to_kind
            """
        )
    )

    op.execute(
        sa.text(
            "DROP TRIGGER IF EXISTS customer_receipts_set_updated_at ON customer_receipts"
        )
    )
    op.execute(sa.text("DROP TABLE IF EXISTS customer_receipts"))

    op.execute(
        sa.text(
            "DROP TRIGGER IF EXISTS payment_allocations_set_updated_at ON payment_allocations"
        )
    )
    op.execute(sa.text("DROP TABLE IF EXISTS payment_allocations"))

    op.execute(
        sa.text(
            "DROP TRIGGER IF EXISTS customer_invoice_lines_set_updated_at ON customer_invoice_lines"
        )
    )
    op.execute(sa.text("DROP TABLE IF EXISTS customer_invoice_lines"))

    op.execute(
        sa.text(
            "DROP TRIGGER IF EXISTS customer_invoices_set_updated_at ON customer_invoices"
        )
    )
    op.execute(sa.text("DROP TABLE IF EXISTS customer_invoices"))

    op.execute(
        sa.text(
            "DROP TRIGGER IF EXISTS customer_payments_set_updated_at ON customer_payments"
        )
    )
    op.execute(sa.text("DROP TABLE IF EXISTS customer_payments"))

    op.execute(
        sa.text(
            "DROP TRIGGER IF EXISTS document_counters_set_updated_at ON document_counters"
        )
    )
    op.execute(sa.text("DROP TABLE IF EXISTS document_counters"))

    op.execute(sa.text("DROP TYPE IF EXISTS billing_invoice_status"))
    op.execute(sa.text("DROP TYPE IF EXISTS billing_bill_to_kind"))
    op.execute(sa.text("DROP TYPE IF EXISTS billing_payment_status"))
    op.execute(sa.text("DROP TYPE IF EXISTS billing_payment_direction"))
