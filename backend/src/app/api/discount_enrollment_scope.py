"""Validate discount code scope for a service instance enrollment."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import DiscountCode, ServiceInstance
from app.exceptions import ValidationError


def ensure_discount_code_eligible_for_instance(
    session: Session,
    *,
    discount_code_id: UUID,
    service_id: UUID,
    instance_id: UUID,
) -> DiscountCode:
    """Load the code and ensure it applies to this instance (global, service, or instance)."""
    row = session.get(DiscountCode, discount_code_id)
    if row is None:
        raise ValidationError("Discount code not found", field="discount_code_id")

    if row.instance_id is not None:
        if row.instance_id != instance_id:
            raise ValidationError(
                "Discount code is not valid for this service instance",
                field="discount_code_id",
            )
        return row

    if row.service_id is not None and row.service_id != service_id:
        raise ValidationError(
            "Discount code is not valid for this service instance",
            field="discount_code_id",
        )

    return row


def service_id_for_instance(session: Session, instance_id: UUID) -> UUID:
    """Return the parent service id for a service instance."""
    inst = session.get(ServiceInstance, instance_id)
    if inst is None:
        raise ValidationError("Service instance not found", field="instance_id")
    return inst.service_id
