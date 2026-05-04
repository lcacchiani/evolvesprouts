"""Admin billing: customer invoice mutations (draft, issue, void, email)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.admin_billing_common import _session_with_audit, contact_display_name
from app.config import get_default_currency_code
from app.api.admin_request import parse_body
from app.db.audit import AuditService
from app.db.models import Contact, Enrollment, Family, Organization
from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.enums import BillingBillToKind, BillingInvoiceStatus
from app.db.models.family import FamilyMember
from app.db.models.organization import OrganizationMember
from app.exceptions import NotFoundError, ValidationError
from app.services.customer_billing import (
    next_invoice_number,
    refresh_invoice_pdf,
    send_invoice_email,
)
from app.services.customer_invoice_pdf import compute_invoice_snapshot_dates
from app.utils import json_response

_CUSTOMIZED_DRAFT_MAX_LINES = 50


def _enrollment_merge_key(en: Enrollment) -> tuple[Any, ...]:
    bk = en.bill_to_kind or BillingBillToKind.CONTACT
    return (
        bk,
        en.bill_to_contact_id,
        en.bill_to_family_id,
        en.bill_to_organization_id,
    )


def _resolve_bill_to_party_for_draft(
    session: Session, *, inv: CustomerInvoice, first: Enrollment
) -> None:
    """Set bill_to_email and bill_to_display_name from enrollment bill-to defaults."""
    if inv.bill_to_kind == BillingBillToKind.CONTACT:
        cid = inv.bill_to_contact_id or first.contact_id
        inv.bill_to_contact_id = cid
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)


def _resolve_bill_to_party_from_invoice_fks(
    session: Session, *, inv: CustomerInvoice
) -> None:
    """Set bill_to_email and bill_to_display_name from invoice bill-to foreign keys."""
    if inv.bill_to_kind == BillingBillToKind.CONTACT:
        cid = inv.bill_to_contact_id
        if cid:
            c = session.get(Contact, cid)
            if c and c.email:
                inv.bill_to_email = c.email
                inv.bill_to_display_name = contact_display_name(c)
        return
    if inv.bill_to_kind == BillingBillToKind.FAMILY and inv.bill_to_family_id:
        fam = session.get(Family, inv.bill_to_family_id)
        if fam is None:
            return
        inv.bill_to_display_name = fam.family_name
        stmt = (
            select(Contact)
            .join(FamilyMember, FamilyMember.contact_id == Contact.id)
            .where(FamilyMember.family_id == inv.bill_to_family_id)
            .where(FamilyMember.is_primary_contact.is_(True))
            .limit(1)
        )
        primary = session.execute(stmt).scalar_one_or_none()
        if primary and primary.email:
            inv.bill_to_email = primary.email
        return
    if (
        inv.bill_to_kind == BillingBillToKind.ORGANIZATION
        and inv.bill_to_organization_id
    ):
        org = session.get(Organization, inv.bill_to_organization_id)
        if org is None:
            return
        inv.bill_to_display_name = org.name
        stmt = (
            select(Contact)
            .join(
                OrganizationMember,
                OrganizationMember.contact_id == Contact.id,
            )
            .where(OrganizationMember.organization_id == inv.bill_to_organization_id)
            .where(OrganizationMember.is_primary_contact.is_(True))
            .limit(1)
        )
        primary = session.execute(stmt).scalar_one_or_none()
        if primary and primary.email:
            inv.bill_to_email = primary.email


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


def _build_bill_to_snapshot(session: Session, inv: CustomerInvoice) -> dict[str, Any]:
    snap: dict[str, Any] = {
        "kind": inv.bill_to_kind.value,
        "display_name": inv.bill_to_display_name,
        "email": inv.bill_to_email,
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


def _decimal_field(raw: Any, *, field: str) -> Decimal:
    try:
        return Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be a decimal number", field=field) from exc


def _parse_bill_to_block(
    body: Mapping[str, Any],
) -> tuple[BillingBillToKind, UUID | None, UUID | None, UUID | None]:
    raw = body.get("billTo") or body.get("bill_to")
    if not isinstance(raw, Mapping):
        raise ValidationError("billTo is required", field="billTo")
    kind_raw = str(raw.get("kind") or "").strip().lower()
    try:
        bill_kind = BillingBillToKind(kind_raw)
    except ValueError as exc:
        raise ValidationError(
            "billTo.kind must be contact, family, or organization",
            field="billTo",
        ) from exc
    cid_raw = raw.get("contactId") or raw.get("contact_id")
    fid_raw = raw.get("familyId") or raw.get("family_id")
    oid_raw = raw.get("organizationId") or raw.get("organization_id")
    cid: UUID | None = None
    fid: UUID | None = None
    oid: UUID | None = None
    if bill_kind == BillingBillToKind.CONTACT:
        if cid_raw is None:
            raise ValidationError("billTo.contactId is required", field="billTo")
        try:
            cid = UUID(str(cid_raw))
        except (ValueError, TypeError) as exc:
            raise ValidationError(
                "billTo.contactId must be a UUID string", field="billTo"
            ) from exc
    elif bill_kind == BillingBillToKind.FAMILY:
        if fid_raw is None:
            raise ValidationError("billTo.familyId is required", field="billTo")
        try:
            fid = UUID(str(fid_raw))
        except (ValueError, TypeError) as exc:
            raise ValidationError(
                "billTo.familyId must be a UUID string", field="billTo"
            ) from exc
    else:
        if oid_raw is None:
            raise ValidationError("billTo.organizationId is required", field="billTo")
        try:
            oid = UUID(str(oid_raw))
        except (ValueError, TypeError) as exc:
            raise ValidationError(
                "billTo.organizationId must be a UUID string", field="billTo"
            ) from exc
    return bill_kind, cid, fid, oid


def _create_customized_invoice_draft(
    event: Mapping[str, Any],
    body: Mapping[str, Any],
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    bill_kind, bill_cid, bill_fid, bill_oid = _parse_bill_to_block(body)
    raw_ccy = body.get("currency")
    if raw_ccy is None or str(raw_ccy).strip() == "":
        raise ValidationError("currency is required", field="currency")
    currency = str(raw_ccy).strip().upper()
    if len(currency) != 3:
        raise ValidationError("currency must be a 3-letter ISO code", field="currency")

    raw_lines = body.get("lines")
    if not isinstance(raw_lines, list) or not raw_lines:
        raise ValidationError("lines must be a non-empty array", field="lines")
    if len(raw_lines) > _CUSTOMIZED_DRAFT_MAX_LINES:
        raise ValidationError(
            f"At most {_CUSTOMIZED_DRAFT_MAX_LINES} lines are allowed",
            field="lines",
        )

    with _session_with_audit(user_sub, request_id) as session:
        if bill_kind == BillingBillToKind.CONTACT:
            assert bill_cid is not None
            if session.get(Contact, bill_cid) is None:
                raise ValidationError("Contact not found", field="billTo")
        elif bill_kind == BillingBillToKind.FAMILY:
            assert bill_fid is not None
            if session.get(Family, bill_fid) is None:
                raise ValidationError("Family not found", field="billTo")
        else:
            assert bill_oid is not None
            if session.get(Organization, bill_oid) is None:
                raise ValidationError("Organization not found", field="billTo")

        inv = CustomerInvoice(
            status=BillingInvoiceStatus.DRAFT,
            currency=currency,
            subtotal=Decimal("0"),
            tax_total=Decimal("0"),
            total=Decimal("0"),
            bill_to_kind=bill_kind,
            bill_to_contact_id=bill_cid,
            bill_to_family_id=bill_fid,
            bill_to_organization_id=bill_oid,
        )
        _resolve_bill_to_party_from_invoice_fks(session, inv=inv)

        session.add(inv)
        session.flush()

        subtotal_pre_tax = Decimal("0")
        tax_sum = Decimal("0")
        for order, raw_ln in enumerate(raw_lines):
            if not isinstance(raw_ln, Mapping):
                raise ValidationError(
                    "Each line must be an object", field=f"lines[{order}]"
                )
            desc = str(raw_ln.get("description") or "").strip()
            if not desc:
                raise ValidationError(
                    "description is required on each line", field=f"lines[{order}]"
                )
            qty = _decimal_field(
                raw_ln.get("quantity"), field=f"lines[{order}].quantity"
            )
            unit_amt = _decimal_field(
                raw_ln.get("unitAmount") or raw_ln.get("unit_amount"),
                field=f"lines[{order}].unitAmount",
            )
            if qty <= 0:
                raise ValidationError(
                    "quantity must be positive", field=f"lines[{order}].quantity"
                )
            extended = qty * unit_amt
            disc_raw = raw_ln.get("discountAmount") or raw_ln.get("discount_amount")
            discount = (
                _decimal_field(disc_raw, field=f"lines[{order}].discountAmount")
                if disc_raw is not None and str(disc_raw).strip() != ""
                else Decimal("0")
            )
            if discount < 0 or discount > extended:
                raise ValidationError(
                    "discountAmount must be between 0 and quantity × unitAmount",
                    field=f"lines[{order}].discountAmount",
                )
            taxable = extended - discount
            tax_amt_raw = raw_ln.get("taxAmount") or raw_ln.get("tax_amount")
            tax_rate_raw = raw_ln.get("taxRate") or raw_ln.get("tax_rate")
            if tax_amt_raw is not None and str(tax_amt_raw).strip() != "":
                tax_part = _decimal_field(
                    tax_amt_raw, field=f"lines[{order}].taxAmount"
                )
            elif tax_rate_raw is not None and str(tax_rate_raw).strip() != "":
                rate = _decimal_field(tax_rate_raw, field=f"lines[{order}].taxRate")
                tax_part = (taxable * rate).quantize(Decimal("0.0001"))
            else:
                tax_part = Decimal("0")
            if tax_part < 0:
                raise ValidationError(
                    "tax amount must not be negative", field=f"lines[{order}].taxAmount"
                )
            tax_rate_val: Decimal | None = None
            if tax_rate_raw is not None and str(tax_rate_raw).strip() != "":
                tax_rate_val = _decimal_field(
                    tax_rate_raw, field=f"lines[{order}].taxRate"
                )
            line_total = taxable + tax_part
            disc_val = discount if discount != 0 else None
            tax_amt_val = tax_part if tax_part != 0 else None

            line = CustomerInvoiceLine(
                invoice_id=inv.id,
                enrollment_id=None,
                line_order=order,
                description=desc[:500],
                quantity=qty,
                unit_amount=unit_amt,
                line_total=line_total,
                discount_amount=disc_val,
                tax_rate=tax_rate_val,
                tax_amount=tax_amt_val,
                currency=currency,
            )
            session.add(line)
            subtotal_pre_tax += taxable
            tax_sum += tax_part

        inv.subtotal = subtotal_pre_tax
        inv.tax_total = tax_sum
        inv.total = subtotal_pre_tax + tax_sum
        session.flush()

        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_invoices",
            record_id=inv.id,
            action="DRAFT_CREATED_CUSTOMIZED",
            new_values={"currency": currency, "line_count": len(raw_lines)},
        )

        return json_response(
            201,
            {"invoiceId": str(inv.id), "status": inv.status.value},
            event=event,
        )


def _create_invoice_draft(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    body = parse_body(event)
    raw_ids = body.get("enrollmentIds") or body.get("enrollment_ids")
    bill_to_raw = body.get("billTo") or body.get("bill_to")
    has_enrollment = isinstance(raw_ids, list) and len(raw_ids) > 0
    has_customized = isinstance(bill_to_raw, Mapping) and len(bill_to_raw) > 0
    if has_enrollment and has_customized:
        raise ValidationError(
            "Use either enrollmentIds or billTo with lines, not both",
            field="enrollmentIds",
        )
    if has_customized:
        return _create_customized_invoice_draft(
            event, body, user_sub=user_sub, request_id=request_id
        )
    if not isinstance(raw_ids, list) or not raw_ids:
        raise ValidationError("enrollmentIds is required", field="enrollmentIds")
    eids: list[UUID] = []
    for x in raw_ids:
        try:
            eids.append(UUID(str(x)))
        except (ValueError, TypeError) as exc:
            raise ValidationError(
                "enrollmentIds must be a list of UUID strings",
                field="enrollmentIds",
            ) from exc
    raw_currency = body.get("currency")
    if raw_currency is None:
        currency_raw = ""
    else:
        currency_raw = str(raw_currency).strip().upper()
    if currency_raw != "" and len(currency_raw) != 3:
        raise ValidationError(
            "currency must be a 3-letter ISO code when provided",
            field="currency",
        )

    overrides_raw = body.get("lineTotalsByEnrollmentId") or body.get(
        "line_totals_by_enrollment_id"
    )
    line_overrides: dict[UUID, Decimal] = {}
    if isinstance(overrides_raw, Mapping):
        for k, v in overrides_raw.items():
            try:
                eid_key = UUID(str(k))
                line_overrides[eid_key] = Decimal(str(v))
            except (ValueError, TypeError, InvalidOperation):
                raise ValidationError(
                    "lineTotalsByEnrollmentId must map enrollment UUID strings to amounts",
                    field="lineTotalsByEnrollmentId",
                ) from None

    with _session_with_audit(user_sub, request_id) as session:
        rows = list(
            session.execute(
                select(Enrollment)
                .where(Enrollment.id.in_(eids))
                .options(
                    joinedload(Enrollment.instance),
                    joinedload(Enrollment.contact),
                )
            )
            .unique()
            .scalars()
            .all()
        )
        by_id = {row.id: row for row in rows}
        missing = [eid for eid in eids if eid not in by_id]
        if missing:
            raise ValidationError(
                f"Enrollment not found: {missing[0]}",
                field="enrollmentIds",
            )
        enrollments = [by_id[eid] for eid in eids]

        default_ccy = get_default_currency_code()
        derived_currencies = {
            (en.currency or default_ccy).upper()[:3] for en in enrollments
        }
        if len(derived_currencies) != 1:
            raise ValidationError(
                "All enrollments must use the same currency",
                field="enrollmentIds",
            )
        derived_currency = next(iter(derived_currencies))
        if currency_raw != "" and currency_raw != derived_currency:
            raise ValidationError(
                "currency must match all enrollments",
                field="currency",
            )
        currency = derived_currency

        keys = {_enrollment_merge_key(e) for e in enrollments}
        if len(keys) != 1:
            raise ValidationError(
                "Merged invoice requires identical bill-to on all enrollments",
                field="enrollmentIds",
            )

        first = enrollments[0]
        bill_kind = first.bill_to_kind or BillingBillToKind.CONTACT
        inv = CustomerInvoice(
            status=BillingInvoiceStatus.DRAFT,
            currency=currency,
            subtotal=Decimal("0"),
            tax_total=Decimal("0"),
            total=Decimal("0"),
            bill_to_kind=bill_kind,
            bill_to_contact_id=first.bill_to_contact_id or first.contact_id,
            bill_to_family_id=first.bill_to_family_id,
            bill_to_organization_id=first.bill_to_organization_id,
        )
        _resolve_bill_to_party_for_draft(session, inv=inv, first=first)

        session.add(inv)
        session.flush()

        subtotal = Decimal("0")
        tax_total = Decimal("0")
        for order, en in enumerate(enrollments):
            title = ""
            if en.instance:
                title = (en.instance.title or "").strip()
            if en.id in line_overrides:
                line_total = line_overrides[en.id]
            else:
                line_total = en.amount_paid or Decimal("0")
            desc = title or "Enrollment"
            line = CustomerInvoiceLine(
                invoice_id=inv.id,
                enrollment_id=en.id,
                line_order=order,
                description=desc[:500],
                quantity=Decimal("1"),
                unit_amount=line_total,
                line_total=line_total,
                currency=currency,
            )
            session.add(line)
            subtotal += line_total

        inv.subtotal = subtotal
        inv.tax_total = tax_total
        inv.total = subtotal + tax_total
        session.flush()

        audit = AuditService(session, user_id=user_sub, request_id=request_id)
        audit.log_custom(
            table_name="customer_invoices",
            record_id=inv.id,
            action="DRAFT_CREATED",
            new_values={"enrollment_ids": [str(x) for x in eids]},
        )

        return json_response(
            201,
            {"invoiceId": str(inv.id), "status": inv.status.value},
            event=event,
        )


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
        inv.bill_to_snapshot = _build_bill_to_snapshot(session, inv)

        num, seq = next_invoice_number(session, currency=inv.currency)
        inv.invoice_number = num
        inv.invoice_sequence = seq
        inv.status = BillingInvoiceStatus.ISSUED
        inv.issued_at = datetime.now(UTC)
        inv.invoice_date, inv.due_date = compute_invoice_snapshot_dates(inv.issued_at)
        session.flush()
        refresh_invoice_pdf(session, inv)

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
        return json_response(
            200, {"invoiceId": str(inv.id), "status": "void"}, event=event
        )


def _validate_to_email(to_email: str) -> None:
    if "@" not in to_email:
        raise ValidationError("toEmail must be a valid email address", field="toEmail")
    local, _, domain = to_email.partition("@")
    if not local or not domain or "." not in domain:
        raise ValidationError("toEmail must be a valid email address", field="toEmail")


def _email_invoice(
    event: Mapping[str, Any],
    invoice_id: UUID,
    *,
    user_sub: str,
    request_id: str | None,
) -> dict[str, Any]:
    body = parse_body(event)
    to_email = str(body.get("toEmail") or body.get("to_email") or "").strip()
    if not to_email:
        raise ValidationError("toEmail is required", field="toEmail")
    _validate_to_email(to_email)
    with _session_with_audit(user_sub, request_id) as session:
        send_invoice_email(session, invoice_id=invoice_id, to_email=to_email)
        return json_response(200, {"sent": True}, event=event)
