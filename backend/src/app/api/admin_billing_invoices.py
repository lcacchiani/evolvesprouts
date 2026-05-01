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
from app.utils import json_response


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
    """Set bill_to_email and bill_to_display_name for contact, family, or org."""
    if inv.bill_to_kind == BillingBillToKind.CONTACT:
        cid = inv.bill_to_contact_id or first.contact_id
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


def _create_invoice_draft(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    body = parse_body(event)
    raw_ids = body.get("enrollmentIds") or body.get("enrollment_ids")
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
