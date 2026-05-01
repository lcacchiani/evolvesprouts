"""Admin billing: enrollments eligible for draft invoice picker."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.admin_billing_common import _session_with_audit
from app.db.models import Contact, Enrollment, FamilyMember, OrganizationMember
from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.enums import BillingBillToKind, BillingInvoiceStatus, EnrollmentStatus
from app.db.models.family import Family
from app.db.models.organization import Organization
from app.utils import json_response


def _decimal_to_string(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value, "f")


def _contact_display_name(c: Contact | None) -> str | None:
    if c is None:
        return None
    return " ".join(x for x in [c.first_name, c.last_name] if x).strip() or None


def _party_display_name(enrollment: Enrollment) -> str:
    bk = enrollment.bill_to_kind or BillingBillToKind.CONTACT
    if bk == BillingBillToKind.CONTACT:
        c = enrollment.bill_to_contact or enrollment.contact
        name = _contact_display_name(c)
        return name if name else "—"
    if bk == BillingBillToKind.FAMILY:
        fam = enrollment.bill_to_family or enrollment.family
        return fam.family_name if fam and fam.family_name else "—"
    if bk == BillingBillToKind.ORGANIZATION:
        org = enrollment.bill_to_organization or enrollment.organization
        return org.name if org and org.name else "—"
    return "—"


def _primary_family_emails(session: Session, family_ids: set[UUID]) -> dict[UUID, str]:
    if not family_ids:
        return {}
    stmt = (
        select(FamilyMember.family_id, Contact.email)
        .join(Contact, FamilyMember.contact_id == Contact.id)
        .where(FamilyMember.family_id.in_(family_ids))
        .where(FamilyMember.is_primary_contact.is_(True))
        .where(Contact.email.is_not(None))
    )
    out: dict[UUID, str] = {}
    for fid, email in session.execute(stmt).all():
        if email and fid not in out:
            out[fid] = str(email)
    return out


def _primary_org_emails(session: Session, org_ids: set[UUID]) -> dict[UUID, str]:
    if not org_ids:
        return {}
    stmt = (
        select(OrganizationMember.organization_id, Contact.email)
        .join(Contact, OrganizationMember.contact_id == Contact.id)
        .where(OrganizationMember.organization_id.in_(org_ids))
        .where(OrganizationMember.is_primary_contact.is_(True))
        .where(Contact.email.is_not(None))
    )
    out: dict[UUID, str] = {}
    for oid, email in session.execute(stmt).all():
        if email and oid not in out:
            out[oid] = str(email)
    return out


def _party_email(
    session: Session,
    enrollment: Enrollment,
    family_emails: dict[UUID, str],
    org_emails: dict[UUID, str],
) -> str | None:
    bk = enrollment.bill_to_kind or BillingBillToKind.CONTACT
    if bk == BillingBillToKind.CONTACT:
        c = enrollment.bill_to_contact or enrollment.contact
        return c.email if c and c.email else None
    if bk == BillingBillToKind.FAMILY:
        fid = enrollment.bill_to_family_id or enrollment.family_id
        if fid and fid in family_emails:
            return family_emails[fid]
        return None
    if bk == BillingBillToKind.ORGANIZATION:
        oid = enrollment.bill_to_organization_id or enrollment.organization_id
        if oid and oid in org_emails:
            return org_emails[oid]
        return None
    return None


def _collect_family_org_ids(rows: list[Enrollment]) -> tuple[set[UUID], set[UUID]]:
    fam: set[UUID] = set()
    org: set[UUID] = set()
    for en in rows:
        bk = en.bill_to_kind or BillingBillToKind.CONTACT
        if bk == BillingBillToKind.FAMILY:
            fid = en.bill_to_family_id or en.family_id
            if fid:
                fam.add(fid)
        elif bk == BillingBillToKind.ORGANIZATION:
            oid = en.bill_to_organization_id or en.organization_id
            if oid:
                org.add(oid)
    return fam, org


def list_recent_enrollments_for_invoicing(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    """Enrollments from the last 90 days (by enrolled_at), excluding cancelled."""
    cutoff = datetime.now(UTC) - timedelta(days=90)
    with _session_with_audit(user_sub, request_id) as session:
        stmt = (
            select(Enrollment)
            .where(Enrollment.enrolled_at >= cutoff)
            .where(Enrollment.status != EnrollmentStatus.CANCELLED)
            .options(
                joinedload(Enrollment.instance),
                joinedload(Enrollment.contact),
                joinedload(Enrollment.family),
                joinedload(Enrollment.organization),
                joinedload(Enrollment.bill_to_contact),
                joinedload(Enrollment.bill_to_family),
                joinedload(Enrollment.bill_to_organization),
                joinedload(Enrollment.ticket_tier),
            )
            .order_by(Enrollment.enrolled_at.desc(), Enrollment.id.desc())
        )
        rows = list(session.execute(stmt).unique().scalars().all())

        blocked_eids = set(
            session.execute(
                select(CustomerInvoiceLine.enrollment_id).join(
                    CustomerInvoice,
                    CustomerInvoiceLine.invoice_id == CustomerInvoice.id,
                )
                .where(
                    CustomerInvoice.status.in_(
                        (
                            BillingInvoiceStatus.DRAFT,
                            BillingInvoiceStatus.ISSUED,
                        )
                    )
                )
            )
            .scalars()
            .all()
        )

        fam_ids, org_ids = _collect_family_org_ids(rows)
        fam_emails = _primary_family_emails(session, fam_ids)
        org_emails = _primary_org_emails(session, org_ids)

        items: list[dict[str, Any]] = []
        for en in rows:
            inst = en.instance
            title = (inst.title or "").strip() if inst else ""
            cohort = (inst.cohort or "").strip() if inst else ""
            tier_name = None
            if en.ticket_tier_id and en.ticket_tier:
                tier_name = en.ticket_tier.name
            currency = (en.currency or "HKD").upper()[:3]
            email = _party_email(session, en, fam_emails, org_emails)
            items.append(
                {
                    "enrollmentId": str(en.id),
                    "partyDisplayName": _party_display_name(en),
                    "partyEmail": email,
                    "instanceTitle": title or None,
                    "serviceTierName": tier_name,
                    "instanceCohort": cohort or None,
                    "amountPaid": _decimal_to_string(en.amount_paid),
                    "currency": currency,
                    "enrolledAt": en.enrolled_at.isoformat()
                    if en.enrolled_at
                    else None,
                    "invoiceLinked": en.id in blocked_eids,
                }
            )

        return json_response(200, {"items": items}, event=event)
