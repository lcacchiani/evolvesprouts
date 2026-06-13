"""Admin API handlers for purchased services on CRM entities."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.admin_billing_invoice_draft_helpers import (
    build_enrollment_invoice_line_description,
)
from app.db.engine import get_engine
from app.db.models import (
    Enrollment,
    EnrollmentStatus,
    FamilyMember,
    OrganizationMember,
    ServiceInstance,
)
from app.db.repositories import (
    ContactRepository,
    FamilyRepository,
    OrganizationRepository,
)
from app.exceptions import NotFoundError
from app.utils import json_response


def _labels_for_enrollments(session: Session, stmt: Any) -> list[str]:
    rows = (
        session.execute(
            stmt.options(
                joinedload(Enrollment.instance).joinedload(ServiceInstance.service),
                joinedload(Enrollment.ticket_tier),
            )
        )
        .unique()
        .scalars()
        .all()
    )
    labels = {build_enrollment_invoice_line_description(en) for en in rows}
    return sorted(labels)


def list_contact_services(
    event: Mapping[str, Any],
    *,
    contact_id: UUID,
) -> dict[str, Any]:
    with Session(get_engine()) as session:
        contact_repo = ContactRepository(session)
        if contact_repo.get_by_id_for_admin(contact_id) is None:
            raise NotFoundError("Contact", str(contact_id))

        stmt = select(Enrollment).where(
            Enrollment.contact_id == contact_id,
            Enrollment.status != EnrollmentStatus.CANCELLED,
        )
        labels = _labels_for_enrollments(session, stmt)
        return json_response(
            200,
            {"items": [{"label": label} for label in labels]},
            event=event,
        )


def list_family_services(
    event: Mapping[str, Any],
    *,
    family_id: UUID,
) -> dict[str, Any]:
    with Session(get_engine()) as session:
        family_repo = FamilyRepository(session)
        if family_repo.get_by_id_for_admin(family_id) is None:
            raise NotFoundError("Family", str(family_id))

        member_contact_ids = select(FamilyMember.contact_id).where(
            FamilyMember.family_id == family_id
        )
        stmt = select(Enrollment).where(
            Enrollment.status != EnrollmentStatus.CANCELLED,
            or_(
                Enrollment.family_id == family_id,
                Enrollment.contact_id.in_(member_contact_ids),
            ),
        )
        labels = _labels_for_enrollments(session, stmt)
        return json_response(
            200,
            {"items": [{"label": label} for label in labels]},
            event=event,
        )


def list_organization_services(
    event: Mapping[str, Any],
    *,
    organization_id: UUID,
) -> dict[str, Any]:
    with Session(get_engine()) as session:
        org_repo = OrganizationRepository(session)
        if org_repo.get_non_vendor_organization_by_id(organization_id) is None:
            raise NotFoundError("Organization", str(organization_id))

        member_contact_ids = select(OrganizationMember.contact_id).where(
            OrganizationMember.organization_id == organization_id
        )
        stmt = select(Enrollment).where(
            Enrollment.status != EnrollmentStatus.CANCELLED,
            or_(
                Enrollment.organization_id == organization_id,
                Enrollment.contact_id.in_(member_contact_ids),
            ),
        )
        labels = _labels_for_enrollments(session, stmt)
        return json_response(
            200,
            {"items": [{"label": label} for label in labels]},
            event=event,
        )
