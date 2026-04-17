"""Shared validation for discount code service/instance scope."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import ServiceInstance
from app.exceptions import ValidationError


def ensure_discount_code_scope(
    session: Session,
    *,
    service_id: UUID | None,
    instance_id: UUID | None,
) -> None:
    """Reject inconsistent scope; verify instance belongs to service when both set."""
    if instance_id is not None and service_id is None:
        raise ValidationError(
            "service_id is required when instance_id is set",
            field="service_id",
        )
    if instance_id is None or service_id is None:
        return
    instance = session.get(ServiceInstance, instance_id)
    if instance is None or instance.service_id != service_id:
        raise ValidationError(
            "instance_id does not belong to the specified service_id",
            field="instance_id",
        )
