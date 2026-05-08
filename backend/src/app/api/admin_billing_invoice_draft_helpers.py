"""Shared helpers for admin billing invoice draft creation."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.admin_billing_common import (
    contact_display_name,
    family_or_organization_bill_to_display_label,
)
from app.db.models import Contact, Enrollment, Family, Organization
from app.db.models.customer_invoice import CustomerInvoice
from app.db.models.enums import BillingBillToKind
from app.db.models.family import FamilyMember
from app.db.models.organization import OrganizationMember
from app.exceptions import ValidationError


def _first_present(d: Mapping[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in d:
            return d[k]
    return None


def _decimal_field(raw: Any, *, field: str) -> Decimal:
    try:
        return Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be a decimal number", field=field) from exc


def _enrollment_merge_key(en: Enrollment) -> tuple[Any, ...]:
    bk = en.bill_to_kind or BillingBillToKind.CONTACT
    return (
        bk,
        en.bill_to_contact_id,
        en.bill_to_family_id,
        en.bill_to_organization_id,
    )


def _resolve_bill_to_party_from_invoice_fks(
    session: Session, *, inv: CustomerInvoice
) -> None:
    """Set bill_to_email and bill_to_display_name from invoice bill-to foreign keys."""
    if inv.bill_to_kind == BillingBillToKind.CONTACT:
        cid = inv.bill_to_contact_id
        if cid:
            c = session.get(Contact, cid)
            if c:
                name = (contact_display_name(c) or "").strip()
                if name:
                    inv.bill_to_display_name = name
                em = (c.email or "").strip()
                if em:
                    inv.bill_to_email = em
        return
    if inv.bill_to_kind == BillingBillToKind.FAMILY and inv.bill_to_family_id:
        fam = session.get(Family, inv.bill_to_family_id)
        if fam is None:
            return
        stmt = (
            select(Contact)
            .join(FamilyMember, FamilyMember.contact_id == Contact.id)
            .where(FamilyMember.family_id == inv.bill_to_family_id)
            .where(FamilyMember.is_primary_contact.is_(True))
            .limit(1)
        )
        primary = session.execute(stmt).scalar_one_or_none()
        label = family_or_organization_bill_to_display_label(
            entity_name=fam.family_name,
            primary_display_name=contact_display_name(primary),
        )
        if label:
            inv.bill_to_display_name = label
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
        label = family_or_organization_bill_to_display_label(
            entity_name=org.name,
            primary_display_name=contact_display_name(primary),
        )
        if label:
            inv.bill_to_display_name = label
        if primary and primary.email:
            inv.bill_to_email = primary.email


def _resolve_bill_to_party_for_draft(
    session: Session, *, inv: CustomerInvoice, first: Enrollment
) -> None:
    """Set bill_to_email and bill_to_display_name from enrollment bill-to defaults."""
    if inv.bill_to_kind == BillingBillToKind.CONTACT:
        cid = inv.bill_to_contact_id or first.contact_id
        inv.bill_to_contact_id = cid
    _resolve_bill_to_party_from_invoice_fks(session, inv=inv)


def _parse_bill_to_block(
    body: Mapping[str, Any],
) -> tuple[BillingBillToKind, UUID | None, UUID | None, UUID | None]:
    raw = _first_present(body, "billTo", "bill_to")
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
    cid_raw = _first_present(raw, "contactId", "contact_id")
    fid_raw = _first_present(raw, "familyId", "family_id")
    oid_raw = _first_present(raw, "organizationId", "organization_id")
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
