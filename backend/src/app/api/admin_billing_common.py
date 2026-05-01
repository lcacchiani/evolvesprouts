"""Shared session, audit context, and bill-to helpers for admin billing handlers."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import Contact, Enrollment
from app.db.models.enums import BillingBillToKind
from app.db.models.family import FamilyMember
from app.db.models.organization import OrganizationMember

DEFAULT_BILLING_LIST_LIMIT = 50


@contextmanager
def _session_with_audit(user_sub: str, request_id_val: str | None):
    """Open a session + transaction and set audit context inside the transaction."""
    with Session(get_engine()) as session:
        with session.begin():
            set_audit_context(session, user_id=user_sub, request_id=request_id_val)
            yield session


def contact_display_name(c: Contact | None) -> str | None:
    """Given a contact row, return a display name or None."""
    if c is None:
        return None
    return " ".join(x for x in [c.first_name, c.last_name] if x).strip() or None


def enrollment_bill_to_merge_key(enrollment: Enrollment) -> str:
    """Stable string key for comparing bill-to identity across enrollments."""
    bk = enrollment.bill_to_kind or BillingBillToKind.CONTACT
    parts = (
        bk.value,
        str(enrollment.bill_to_contact_id) if enrollment.bill_to_contact_id else "",
        str(enrollment.bill_to_family_id) if enrollment.bill_to_family_id else "",
        str(enrollment.bill_to_organization_id)
        if enrollment.bill_to_organization_id
        else "",
    )
    return "|".join(parts)


def primary_family_emails(session: Session, family_ids: set[UUID]) -> dict[UUID, str]:
    """Map family id -> primary contact email when present."""
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


def primary_org_emails(session: Session, org_ids: set[UUID]) -> dict[UUID, str]:
    """Map organization id -> primary contact email when present."""
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
