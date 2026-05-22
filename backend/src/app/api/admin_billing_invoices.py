"""Admin billing: customer invoice mutations (issue, void, email, delete draft)."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.admin_billing_common import _session_with_audit
from app.api.admin_billing_invoice_draft_helpers import (
    _resolve_bill_to_party_from_invoice_fks,
)
from app.api.admin_request import parse_body
from app.db.audit import AuditService
from app.db.models import Contact, Family, Organization
from app.db.models.customer_invoice import CustomerInvoice
from app.db.models.enums import BillingBillToKind, BillingInvoiceStatus
from app.db.models.payment_allocation import PaymentAllocation
from app.exceptions import NotFoundError, ValidationError
from app.services.billing_enrollment_confirmation import (
    maybe_confirm_enrollments_on_zero_total_invoice_issue,
)
from app.services.customer_billing import (
    next_invoice_number,
    refresh_invoice_pdf,
    recompute_invoice_settlement,
    send_invoice_email,
)
from app.services.customer_invoice_pdf import (
    add_payment_terms,
    compute_invoice_snapshot_dates,
)
from app.utils import json_response


def _validate_bill_to_fk_for_issue(inv: CustomerInvoice) -> None:
    if inv.bill_to_kind == BillingBillToKind.CONTACT:
        if inv.bill_to_contact_id is None:
            raise ValidationError(
                "Invoice bill-to contact is required before issue",
                field="invoiceId",
            )
        if inv.bill_to_family_id is not None or inv.bill_to_organization_id is not None:
            raise ValidationError(
                "Invoice has inconsistent bill-to foreign keys",
                field="invoiceId",
            )
        return
    if inv.bill_to_kind == BillingBillToKind.FAMILY:
        if inv.bill_to_family_id is None:
            raise ValidationError(
                "Invoice bill-to family is required before issue",
                field="invoiceId",
            )
        if (
            inv.bill_to_contact_id is not None
            or inv.bill_to_organization_id is not None
        ):
            raise ValidationError(
                "Invoice has inconsistent bill-to foreign keys",
                field="invoiceId",
            )
        return
    if inv.bill_to_kind == BillingBillToKind.ORGANIZATION:
        if inv.bill_to_organization_id is None:
            raise ValidationError(
                "Invoice bill-to organization is required before issue",
                field="invoiceId",
            )
        if inv.bill_to_contact_id is not None or inv.bill_to_family_id is not None:
            raise ValidationError(
                "Invoice has inconsistent bill-to foreign keys",
                field="invoiceId",
            )


def maybe_refresh_issued_bill_to_snapshot(
    session: Session, inv: CustomerInvoice
) -> bool:
    """Heal an issued invoice whose ``bill_to_location_text`` is missing.

    Older issued invoices may have an empty ``bill_to_location_text`` because the
    snapshot resolver did not yet support the contact-membership fallback for
    member contacts (admin contact mutations forbid setting ``Contact.location_id``
    when the contact is linked to a family or organisation; see
    ``admin_billing_invoice_draft_helpers._resolve_bill_to_party_from_invoice_fks``).

    To repair these without violating issued-invoice immutability for already
    populated snapshots, this helper:

    - returns ``False`` when ``bill_to_location_text`` is already non-empty (no-op
      so issued PDFs with valid addresses remain byte-stable);
    - otherwise re-resolves the bill-to party; if re-resolution yields a non-empty
      location, persists the new ``bill_to_*`` columns + regenerated
      ``bill_to_snapshot`` JSON and re-renders the issued PDF;
    - otherwise restores the original (empty) state and leaves the invoice
      untouched.

    Invoice number, totals, lines, and dates are never modified — only the
    bill-to snapshot fields and the issued PDF artifact are regenerated, and
    only when the address was missing.
    """
    existing = (inv.bill_to_location_text or "").strip()
    if existing:
        return False
    prev_name = inv.bill_to_display_name
    prev_email = inv.bill_to_email
    prev_loc = inv.bill_to_location_text
    prev_snap = inv.bill_to_snapshot
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)
    new_loc = (inv.bill_to_location_text or "").strip()
    if not new_loc:
        inv.bill_to_display_name = prev_name
        inv.bill_to_email = prev_email
        inv.bill_to_location_text = prev_loc
        inv.bill_to_snapshot = prev_snap
        return False
    inv.bill_to_snapshot = _build_bill_to_snapshot(session, inv)
    session.flush()
    refresh_invoice_pdf(session, inv)
    return True


def _build_bill_to_snapshot(session: Session, inv: CustomerInvoice) -> dict[str, Any]:
    snap: dict[str, Any] = {
        "kind": inv.bill_to_kind.value,
        "display_name": inv.bill_to_display_name,
        "email": inv.bill_to_email,
        "location_text": inv.bill_to_location_text,
        "snapshot_at": datetime.now(UTC).isoformat(),
    }
    if inv.bill_to_kind == BillingBillToKind.CONTACT and inv.bill_to_contact_id:
        c = session.get(Contact, inv.bill_to_contact_id)
        if c:
            snap["contact"] = {
                "id": str(c.id),
                "first_name": c.first_name,
                "last_name": c.last_name,
                "email": c.email,
            }
    elif inv.bill_to_kind == BillingBillToKind.FAMILY and inv.bill_to_family_id:
        fam = session.get(Family, inv.bill_to_family_id)
        if fam:
            snap["family"] = {"id": str(fam.id), "family_name": fam.family_name}
    elif (
        inv.bill_to_kind == BillingBillToKind.ORGANIZATION
        and inv.bill_to_organization_id
    ):
        org = session.get(Organization, inv.bill_to_organization_id)
        if org:
            snap["organization"] = {"id": str(org.id), "name": org.name}
    return snap


def _issue_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    with _session_with_audit(user_sub, request_id) as session:
        inv = session.get(CustomerInvoice, invoice_id)
        if inv is None:
            raise NotFoundError("CustomerInvoice", str(invoice_id))
        if inv.status != BillingInvoiceStatus.DRAFT:
            raise ValidationError("Invoice is not draft", field="invoiceId")

        _validate_bill_to_fk_for_issue(inv)
        _resolve_bill_to_party_from_invoice_fks(session, inv=inv)
        inv.bill_to_snapshot = _build_bill_to_snapshot(session, inv)

        num, seq = next_invoice_number(session)
        inv.invoice_number = num
        inv.invoice_sequence = seq
        inv.status = BillingInvoiceStatus.ISSUED
        inv.issued_at = datetime.now(UTC)
        if inv.invoice_date is None:
            inv.invoice_date, inv.due_date = compute_invoice_snapshot_dates(
                inv.issued_at
            )
        else:
            inv.due_date = add_payment_terms(inv.invoice_date)
        session.flush()
        refresh_invoice_pdf(session, inv)
        maybe_confirm_enrollments_on_zero_total_invoice_issue(session, inv)
        recompute_invoice_settlement(session, inv)

        return json_response(
            200,
            {
                "invoiceId": str(inv.id),
                "invoiceNumber": inv.invoice_number,
                "issuedPdfSha256": inv.issued_pdf_sha256,
            },
            event=event,
        )


def _void_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    body = parse_body(event)
    reason = str(body.get("reason") or "").strip()
    if not reason:
        raise ValidationError("reason is required", field="reason")
    with _session_with_audit(user_sub, request_id) as session:
        inv = session.get(CustomerInvoice, invoice_id)
        if inv is None:
            raise NotFoundError("CustomerInvoice", str(invoice_id))
        if inv.status == BillingInvoiceStatus.VOID:
            raise ValidationError("Invoice is already void", field="invoiceId")
        prev = inv.status
        inv.status = BillingInvoiceStatus.VOID
        inv.voided_at = datetime.now(UTC)
        inv.void_reason = reason[:2000]
        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_invoices",
            record_id=inv.id,
            action=(
                "VOID_FROM_DRAFT"
                if prev == BillingInvoiceStatus.DRAFT
                else "VOID_FROM_ISSUED"
            ),
            new_values={"reason": inv.void_reason},
        )
        recompute_invoice_settlement(session, inv)
        return json_response(
            200, {"invoiceId": str(inv.id), "status": "void"}, event=event
        )


def _delete_draft_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    """Permanently remove a draft invoice and its lines (no issued number)."""
    with _session_with_audit(user_sub, request_id) as session:
        inv = session.get(CustomerInvoice, invoice_id)
        if inv is None:
            raise NotFoundError("CustomerInvoice", str(invoice_id))
        if inv.status != BillingInvoiceStatus.DRAFT:
            raise ValidationError(
                "Only draft invoices can be deleted", field="invoiceId"
            )
        alloc_count = session.execute(
            select(func.count())
            .select_from(PaymentAllocation)
            .where(PaymentAllocation.invoice_id == invoice_id)
        ).scalar_one()
        if int(alloc_count or 0) > 0:
            raise ValidationError(
                "Cannot delete invoice with payment allocations",
                field="invoiceId",
            )
        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_invoices",
            record_id=inv.id,
            action="DELETE_DRAFT",
            old_values={"status": inv.status.value},
        )
        session.delete(inv)
        session.flush()
        return json_response(
            200,
            {"invoiceId": str(invoice_id), "deleted": True},
            event=event,
        )


def _validate_to_email(to_email: str) -> None:
    if "@" not in to_email:
        raise ValidationError("toEmail must be a valid email address", field="toEmail")
    local, _, domain = to_email.partition("@")
    if not local or not domain or "." not in domain:
        raise ValidationError("toEmail must be a valid email address", field="toEmail")


def _parse_to_email_list(raw: str) -> list[str]:
    """Split comma-separated recipient list and validate each address."""
    parts = [p.strip() for p in raw.replace(";", ",").split(",")]
    addresses = [p for p in parts if p != ""]
    if not addresses:
        raise ValidationError("toEmail is required", field="toEmail")
    for addr in addresses:
        _validate_to_email(addr)
    return addresses


def _email_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    body = parse_body(event)
    to_raw = str(body.get("toEmail") or body.get("to_email") or "").strip()
    if not to_raw:
        raise ValidationError("toEmail is required", field="toEmail")
    to_addresses = _parse_to_email_list(to_raw)
    with _session_with_audit(user_sub, request_id) as session:
        send_invoice_email(session, invoice_id=invoice_id, to_addresses=to_addresses)
        return json_response(200, {"sent": True}, event=event)
