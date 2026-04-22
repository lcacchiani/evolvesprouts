"""Partner organization links for admin service instances."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import Organization, ServiceInstancePartnerOrganization
from app.exceptions import ValidationError
from app.utils.logging import get_logger

from .admin_services_payload_utils import parse_uuid_list

logger = get_logger(__name__)


def parse_partner_organization_ids(body: Mapping[str, Any]) -> list[UUID]:
    """Parse partner_organization_ids; dedupe while preserving order."""
    raw = parse_uuid_list(body.get("partner_organization_ids"), "partner_organization_ids")
    seen: set[UUID] = set()
    ordered: list[UUID] = []
    for org_id in raw:
        if org_id not in seen:
            seen.add(org_id)
            ordered.append(org_id)
    return ordered


def validate_partner_organization_ids(
    session: Session, org_ids: list[UUID]
) -> None:
    """Raise ValidationError if any organization id does not exist."""
    if not org_ids:
        return
    statement = select(Organization.id).where(Organization.id.in_(org_ids))
    found = {row[0] for row in session.execute(statement).all()}
    missing = [str(i) for i in org_ids if i not in found]
    if missing:
        raise ValidationError(
            "Unknown partner_organization_ids",
            field="partner_organization_ids",
        )


def reconcile_instance_partner_organizations(
    session: Session,
    *,
    instance_id: UUID,
    ordered_org_ids: list[UUID],
) -> None:
    """Replace M2M rows for the instance with the given ordered org ids."""
    logger.debug(
        "Reconciling instance partner organizations",
        extra={"instance_id": str(instance_id), "count": len(ordered_org_ids)},
    )
    session.execute(
        delete(ServiceInstancePartnerOrganization).where(
            ServiceInstancePartnerOrganization.service_instance_id == instance_id
        )
    )
    for sort_order, org_id in enumerate(ordered_org_ids):
        session.add(
            ServiceInstancePartnerOrganization(
                service_instance_id=instance_id,
                organization_id=org_id,
                sort_order=sort_order,
            )
        )
