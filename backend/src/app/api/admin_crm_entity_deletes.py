"""Permanent delete helpers for admin CRM family and organisation records."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.admin_crm_helpers import request_id
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import Enrollment, Note, RelationshipType, SalesLead
from app.db.repositories import FamilyRepository, OrganizationRepository
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _delete_notes_for_leads(session: Session, lead_ids: list[UUID]) -> None:
    if not lead_ids:
        return
    session.execute(delete(Note).where(Note.lead_id.in_(tuple(lead_ids))))


def _delete_sales_leads_for_family(session: Session, family_id: UUID) -> None:
    lead_ids = list(
        session.scalars(
            select(SalesLead.id).where(SalesLead.family_id == family_id)
        ).all()
    )
    _delete_notes_for_leads(session, lead_ids)
    if lead_ids:
        session.execute(delete(SalesLead).where(SalesLead.id.in_(tuple(lead_ids))))


def _delete_sales_leads_for_organization(
    session: Session, organization_id: UUID
) -> None:
    lead_ids = list(
        session.scalars(
            select(SalesLead.id).where(SalesLead.organization_id == organization_id)
        ).all()
    )
    _delete_notes_for_leads(session, lead_ids)
    if lead_ids:
        session.execute(delete(SalesLead).where(SalesLead.id.in_(tuple(lead_ids))))


def delete_admin_crm_family(
    event: Mapping[str, Any],
    *,
    family_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    """Permanently delete one CRM family and dependent rows that would block deletion."""
    logger.info(
        "Deleting admin CRM family",
        extra={"family_id": str(family_id), "actor_sub": actor_sub},
    )

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = FamilyRepository(session)
        family = repository.get_by_id_for_admin(family_id)
        if family is None:
            raise NotFoundError("Family", str(family_id))

        _delete_sales_leads_for_family(session, family_id)
        session.execute(delete(Note).where(Note.family_id == family_id))
        session.execute(delete(Enrollment).where(Enrollment.family_id == family_id))

        try:
            repository.delete(family)
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            raise ValidationError(
                "Family cannot be deleted while it is still referenced",
                field="family_id",
            ) from exc

        return json_response(204, {}, event=event)


def delete_admin_crm_organization(
    event: Mapping[str, Any],
    *,
    organization_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    """Permanently delete one non-vendor CRM organisation and dependent rows."""
    logger.info(
        "Deleting admin CRM organization",
        extra={"organization_id": str(organization_id), "actor_sub": actor_sub},
    )

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = OrganizationRepository(session)
        org = repository.get_organization_by_id(organization_id)
        if org is None:
            raise NotFoundError("Organization", str(organization_id))
        if org.relationship_type == RelationshipType.VENDOR:
            raise ValidationError(
                "Vendor organizations are managed under Finance",
                field="organization_id",
            )

        _delete_sales_leads_for_organization(session, organization_id)
        session.execute(delete(Note).where(Note.organization_id == organization_id))
        session.execute(
            delete(Enrollment).where(Enrollment.organization_id == organization_id)
        )

        try:
            repository.delete(org)
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            raise ValidationError(
                "Organization cannot be deleted while it is still referenced",
                field="organization_id",
            ) from exc

        return json_response(204, {}, event=event)
