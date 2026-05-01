"""Admin billing: enrollments eligible for draft invoice picker."""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import and_, cast, or_, select, String
from sqlalchemy.orm import Session, joinedload

from app.api.admin_billing_common import (
    _session_with_audit,
    contact_display_name,
    enrollment_bill_to_merge_key,
    primary_family_emails,
    primary_org_emails,
)
from app.api.admin_request import parse_limit, query_param
from app.config import get_default_currency_code
from app.db.models import Enrollment
from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.enums import (
    BillingBillToKind,
    BillingInvoiceStatus,
    EnrollmentStatus,
)
from app.db.models.service_instance import ServiceInstance
from app.exceptions import ValidationError
from app.utils import json_response


def _decimal_to_string(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value, "f")


def _party_display_name(enrollment: Enrollment) -> str:
    bk = enrollment.bill_to_kind or BillingBillToKind.CONTACT
    if bk == BillingBillToKind.CONTACT:
        c = enrollment.bill_to_contact or enrollment.contact
        name = contact_display_name(c)
        return name if name else "—"
    if bk == BillingBillToKind.FAMILY:
        fam = enrollment.bill_to_family or enrollment.family
        return fam.family_name if fam and fam.family_name else "—"
    if bk == BillingBillToKind.ORGANIZATION:
        org = enrollment.bill_to_organization or enrollment.organization
        return org.name if org and org.name else "—"
    return "—"


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


_PICKER_MAX_LIMIT = 500


def _parse_enrolled_at_cursor(raw: str | None) -> tuple[datetime | None, UUID | None]:
    if not raw or not str(raw).strip():
        return None, None
    try:
        padding = "=" * (-len(raw) % 4)
        decoded = base64.urlsafe_b64decode(raw + padding)
        payload = json.loads(decoded)
        ts = datetime.fromisoformat(str(payload["enrolled_at"]).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        else:
            ts = ts.astimezone(UTC)
        eid = UUID(str(payload["id"]))
        return ts, eid
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise ValidationError("Invalid cursor", field="cursor") from exc


def _encode_enrolled_at_cursor(enrolled_at: datetime, row_id: UUID) -> str:
    ts = (
        enrolled_at.astimezone(UTC)
        if enrolled_at.tzinfo
        else enrolled_at.replace(tzinfo=UTC)
    )
    payload = json.dumps({"enrolled_at": ts.isoformat(), "id": str(row_id)}).encode(
        "utf-8"
    )
    return base64.urlsafe_b64encode(payload).decode("utf-8").rstrip("=")


def list_recent_enrollments_for_invoicing(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    """Non-cancelled enrollments from the last 90 days (`enrolled_at`), capped and paginated."""
    cutoff = datetime.now(UTC) - timedelta(days=90)
    limit = parse_limit(event, default=_PICKER_MAX_LIMIT, max_limit=_PICKER_MAX_LIMIT)
    cursor_ts, cursor_id = _parse_enrolled_at_cursor(query_param(event, "cursor"))
    q_raw = (query_param(event, "q") or "").strip()

    with _session_with_audit(user_sub, request_id) as session:
        stmt = (
            select(Enrollment)
            .where(Enrollment.enrolled_at >= cutoff)
            .where(Enrollment.status != EnrollmentStatus.CANCELLED)
        )
        if cursor_ts is not None and cursor_id is not None:
            stmt = stmt.where(
                or_(
                    Enrollment.enrolled_at < cursor_ts,
                    and_(
                        Enrollment.enrolled_at == cursor_ts,
                        Enrollment.id < cursor_id,
                    ),
                )
            )

        if q_raw:
            q_pat = f"%{q_raw}%"
            stmt = stmt.join(
                ServiceInstance, Enrollment.instance_id == ServiceInstance.id
            ).where(
                or_(
                    cast(Enrollment.id, String).ilike(q_pat),
                    ServiceInstance.title.ilike(q_pat),
                    ServiceInstance.cohort.ilike(q_pat),
                )
            )

        stmt = (
            stmt.options(
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
            .limit(limit + 1)
        )

        rows = list(session.execute(stmt).unique().scalars().all())
        truncated = len(rows) > limit
        page_rows = rows[:limit]

        blocked_eids: set[UUID] = set()
        cand_ids = {en.id for en in page_rows}
        if cand_ids:
            blocked_eids = set(
                session.execute(
                    select(CustomerInvoiceLine.enrollment_id)
                    .join(
                        CustomerInvoice,
                        CustomerInvoiceLine.invoice_id == CustomerInvoice.id,
                    )
                    .where(CustomerInvoiceLine.enrollment_id.in_(cand_ids))
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

        fam_ids, org_ids = _collect_family_org_ids(page_rows)
        fam_emails = primary_family_emails(session, fam_ids)
        org_emails = primary_org_emails(session, org_ids)

        default_ccy = get_default_currency_code()
        items: list[dict[str, Any]] = []
        for en in page_rows:
            inst = en.instance
            title = (inst.title or "").strip() if inst else ""
            cohort = (inst.cohort or "").strip() if inst else ""
            tier_name = None
            if en.ticket_tier_id and en.ticket_tier:
                tier_name = en.ticket_tier.name
            currency = (en.currency or default_ccy).upper()[:3]
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
                    "billToMergeKey": enrollment_bill_to_merge_key(en),
                }
            )

        next_cursor = None
        if truncated and page_rows:
            last = page_rows[-1]
            if last.enrolled_at:
                next_cursor = _encode_enrolled_at_cursor(last.enrolled_at, last.id)

        body: dict[str, Any] = {
            "items": items,
            "truncated": truncated,
            "next_cursor": next_cursor,
        }
        return json_response(200, body, event=event)
