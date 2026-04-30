"""Customer billing (AR), audit_log table, triggers, enrollment bill-to.

Adds ``audit_log`` (hybrid trigger context per docs/architecture/audit-logging.md),
customer payment/allocation/invoice/receipt tables, document counters, enrollment
billing columns, and audit triggers on new billing tables.

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

revision: str = "0052_customer_billing_ar"
down_revision: Union[str, None] = "0051_backfill_event_service_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                action TEXT NOT NULL,
                user_id TEXT,
                request_id TEXT,
                old_values JSONB,
                new_values JSONB,
                changed_fields TEXT[],
                source TEXT NOT NULL DEFAULT 'trigger',
                ip_address TEXT,
                user_agent TEXT
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS audit_log_table_record_idx
            ON audit_log (table_name, record_id)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx
            ON audit_log (timestamp DESC)
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS audit_log_user_id_idx
            ON audit_log (user_id)
            WHERE user_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS audit_log_action_idx
            ON audit_log (action)
            """
        )
    )

    op.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION billing_audit_row_change()
            RETURNS TRIGGER AS $$
            DECLARE
                v_uid TEXT := NULLIF(current_setting('app.current_user_id', true), '');
                v_rid TEXT := NULLIF(current_setting('app.current_request_id', true), '');
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    INSERT INTO audit_log (
                        table_name, record_id, action,
                        new_values, user_id, request_id, source
                    ) VALUES (
                        TG_TABLE_NAME,
                        NEW.id::text,
                        'INSERT',
                        to_jsonb(NEW),
                        NULLIF(v_uid, ''),
                        NULLIF(v_rid, ''),
                        'trigger'
                    );
                    RETURN NEW;
                ELSIF TG_OP = 'UPDATE' THEN
                    INSERT INTO audit_log (
                        table_name, record_id, action,
                        old_values, new_values, changed_fields,
                        user_id, request_id, source
                    ) VALUES (
                        TG_TABLE_NAME,
                        NEW.id::text,
                        'UPDATE',
                        to_jsonb(OLD),
                        to_jsonb(NEW),
                        NULL,
                        NULLIF(v_uid, ''),
                        NULLIF(v_rid, ''),
                        'trigger'
                    );
                    RETURN NEW;
                ELSIF TG_OP = 'DELETE' THEN
                    INSERT INTO audit_log (
                        table_name, record_id, action,
                        old_values, user_id, request_id, source
                    ) VALUES (
                        TG_TABLE_NAME,
                        OLD.id::text,
                        'DELETE',
                        to_jsonb(OLD),
                        NULLIF(v_uid, ''),
                        NULLIF(v_rid, ''),
                        'trigger'
                    );
                    RETURN OLD;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql
            """
        )
    )

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
                method TEXT NOT NULL,
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
            CREATE TRIGGER customer_payments_audit
            AFTER INSERT OR UPDATE OR DELETE ON customer_payments
            FOR EACH ROW EXECUTE FUNCTION billing_audit_row_change()
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
            CREATE TRIGGER customer_invoices_audit
            AFTER INSERT OR UPDATE OR DELETE ON customer_invoices
            FOR EACH ROW EXECUTE FUNCTION billing_audit_row_change()
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
            CREATE TRIGGER customer_invoice_lines_audit
            AFTER INSERT OR UPDATE OR DELETE ON customer_invoice_lines
            FOR EACH ROW EXECUTE FUNCTION billing_audit_row_change()
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
                reversal_of_allocation_id UUID REFERENCES payment_allocations(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT payment_allocations_nonzero CHECK (allocated_amount <> 0)
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
            CREATE TRIGGER payment_allocations_audit
            AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
            FOR EACH ROW EXECUTE FUNCTION billing_audit_row_change()
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
            CREATE TRIGGER customer_receipts_audit
            AFTER INSERT OR UPDATE OR DELETE ON customer_receipts
            FOR EACH ROW EXECUTE FUNCTION billing_audit_row_change()
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


def downgrade() -> None:
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

    op.execute(sa.text("DROP TRIGGER IF EXISTS customer_receipts_audit ON customer_receipts"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS customer_receipts_set_updated_at ON customer_receipts"))
    op.execute(sa.text("DROP TABLE IF EXISTS customer_receipts"))

    op.execute(sa.text("DROP TRIGGER IF EXISTS payment_allocations_audit ON payment_allocations"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS payment_allocations_set_updated_at ON payment_allocations"))
    op.execute(sa.text("DROP TABLE IF EXISTS payment_allocations"))

    op.execute(sa.text("DROP TRIGGER IF EXISTS customer_invoice_lines_audit ON customer_invoice_lines"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS customer_invoice_lines_set_updated_at ON customer_invoice_lines"))
    op.execute(sa.text("DROP TABLE IF EXISTS customer_invoice_lines"))

    op.execute(sa.text("DROP TRIGGER IF EXISTS customer_invoices_audit ON customer_invoices"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS customer_invoices_set_updated_at ON customer_invoices"))
    op.execute(sa.text("DROP TABLE IF EXISTS customer_invoices"))

    op.execute(sa.text("DROP TRIGGER IF EXISTS customer_payments_audit ON customer_payments"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS customer_payments_set_updated_at ON customer_payments"))
    op.execute(sa.text("DROP TABLE IF EXISTS customer_payments"))

    op.execute(sa.text("DROP TRIGGER IF EXISTS document_counters_set_updated_at ON document_counters"))
    op.execute(sa.text("DROP TABLE IF EXISTS document_counters"))

    op.execute(sa.text("DROP FUNCTION IF EXISTS billing_audit_row_change()"))

    op.execute(sa.text("DROP TYPE IF EXISTS billing_invoice_status"))
    op.execute(sa.text("DROP TYPE IF EXISTS billing_bill_to_kind"))
    op.execute(sa.text("DROP TYPE IF EXISTS billing_payment_status"))
    op.execute(sa.text("DROP TYPE IF EXISTS billing_payment_direction"))

    op.execute(sa.text("DROP TABLE IF EXISTS audit_log"))
