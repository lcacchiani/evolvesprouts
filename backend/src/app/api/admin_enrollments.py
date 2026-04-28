"""Admin enrollment API handlers."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_request import parse_body, parse_uuid
from app.api.admin_services_common import (
    encode_enrollment_cursor,
    parse_create_enrollment_payload,
    parse_enrollment_filters,
    parse_update_enrollment_payload,
    request_id,
    serialize_enrollment,
)
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import Enrollment
from app.db.models.enums import EnrollmentStatus
from app.db.repositories import DiscountCodeRepository, EnrollmentRepository
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def handle_admin_enrollments_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
    instance_id: UUID,
) -> dict[str, Any]:
    """Handle nested enrollment routes under an instance."""
    logger.info(
        "Handling admin enrollments route",
        extra={"method": method, "path": path, "instance_id": str(instance_id)},
    )
    parts = split_route_parts(path)
    if len(parts) < 6 or parts[0] != "admin" or parts[1] != "services":
        return json_response(404, {"error": "Not found"}, event=event)
    if parts[5] != "enrollments":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 6:
        if method == "GET":
            return _list_enrollments(event, instance_id=instance_id)
        if method == "POST":
            return _create_enrollment(
                event, instance_id=instance_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    enrollment_id = parse_uuid(parts[6])
    if len(parts) == 7:
        if method == "PATCH":
            return _update_enrollment(
                event,
                instance_id=instance_id,
                enrollment_id=enrollment_id,
                actor_sub=identity.user_sub,
            )
        if method == "DELETE":
            return _delete_enrollment(
                event,
                instance_id=instance_id,
                enrollment_id=enrollment_id,
                actor_sub=identity.user_sub,
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_enrollments(event: Mapping[str, Any], *, instance_id: UUID) -> dict[str, Any]:
    filters = parse_enrollment_filters(event)
    limit = filters["limit"]
    logger.info(
        "Listing enrollments",
        extra={"instance_id": str(instance_id), "limit": limit},
    )
    with Session(get_engine()) as session:
        repository = EnrollmentRepository(session)
        rows = repository.list_enrollments(
            instance_id=instance_id,
            limit=limit + 1,
            status=filters["status"],
            cursor_created_at=filters["cursor_created_at"],
            cursor_id=filters["cursor_id"],
        )
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        next_cursor = (
            encode_enrollment_cursor(page_rows[-1]) if has_more and page_rows else None
        )
        total_count = repository.count_enrollments(
            instance_id=instance_id, status=filters["status"]
        )
        return json_response(
            200,
            {
                "items": [serialize_enrollment(row) for row in page_rows],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _create_enrollment(
    event: Mapping[str, Any], *, instance_id: UUID, actor_sub: str
) -> dict[str, Any]:
    body = parse_body(event)
    payload = parse_create_enrollment_payload(body)
    logger.info(
        "Creating enrollment",
        extra={
            "instance_id": str(instance_id),
            "actor_sub": actor_sub,
            "discount_code_id": str(payload["discount_code_id"])
            if payload["discount_code_id"]
            else None,
        },
    )
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = EnrollmentRepository(session)
        discount_code_repository = DiscountCodeRepository(session)
        discount_code_id = payload["discount_code_id"]
        if discount_code_id is not None:
            if not discount_code_repository.validate_and_increment(discount_code_id):
                raise ValidationError(
                    "Discount code is invalid, inactive, expired, or exhausted",
                    field="discount_code_id",
                )
        enrollment = Enrollment(
            instance_id=instance_id,
            contact_id=payload["contact_id"],
            family_id=payload["family_id"],
            organization_id=payload["organization_id"],
            ticket_tier_id=payload["ticket_tier_id"],
            discount_code_id=payload["discount_code_id"],
            status=payload["status"],
            amount_paid=payload["amount_paid"],
            currency=payload["currency"],
            notes=payload["notes"],
            created_by=actor_sub,
        )
        created = repository.create_enrollment(enrollment)
        session.commit()
        return json_response(
            201,
            {"enrollment": serialize_enrollment(created)},
            event=event,
        )


def _update_enrollment(
    event: Mapping[str, Any],
    *,
    instance_id: UUID,
    enrollment_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    payload = parse_update_enrollment_payload(body)
    logger.info(
        "Updating enrollment",
        extra={
            "instance_id": str(instance_id),
            "enrollment_id": str(enrollment_id),
            "actor_sub": actor_sub,
        },
    )
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = EnrollmentRepository(session)
        enrollment = repository.get_by_id(enrollment_id)
        if enrollment is None or enrollment.instance_id != instance_id:
            raise NotFoundError("Enrollment", str(enrollment_id))

        if "status" in payload:
            enrollment.status = payload["status"]
            if payload["status"] == EnrollmentStatus.CANCELLED:
                enrollment.cancelled_at = datetime.now(UTC)
            else:
                enrollment.cancelled_at = None
        if "amount_paid" in payload:
            enrollment.amount_paid = payload["amount_paid"]
        if "currency" in payload:
            enrollment.currency = payload["currency"]
        if "notes" in payload:
            enrollment.notes = payload["notes"]
        if "discount_code_id" in payload:
            new_id = payload["discount_code_id"]
            old_id = enrollment.discount_code_id
            if new_id != old_id:
                discount_repo = DiscountCodeRepository(session)
                if old_id is not None:
                    if not discount_repo.decrement_uses(old_id):
                        raise ValidationError(
                            "Unable to release prior discount code usage",
                            field="discount_code_id",
                        )
                if new_id is not None:
                    if not discount_repo.validate_and_increment(new_id):
                        if old_id is not None:
                            discount_repo.validate_and_increment(old_id)
                        raise ValidationError(
                            "Discount code is invalid, inactive, expired, or exhausted",
                            field="discount_code_id",
                        )
                enrollment.discount_code_id = new_id

        updated = repository.update(enrollment)
        session.commit()
        return json_response(
            200,
            {"enrollment": serialize_enrollment(updated)},
            event=event,
        )


def _delete_enrollment(
    event: Mapping[str, Any],
    *,
    instance_id: UUID,
    enrollment_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    logger.info(
        "Deleting enrollment",
        extra={
            "instance_id": str(instance_id),
            "enrollment_id": str(enrollment_id),
            "actor_sub": actor_sub,
        },
    )
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = EnrollmentRepository(session)
        enrollment = repository.get_by_id(enrollment_id)
        if enrollment is None or enrollment.instance_id != instance_id:
            raise NotFoundError("Enrollment", str(enrollment_id))
        discount_repo = DiscountCodeRepository(session)
        if enrollment.discount_code_id is not None:
            if not discount_repo.decrement_uses(enrollment.discount_code_id):
                raise ValidationError(
                    "Unable to release discount code usage for this enrollment",
                    field="discount_code_id",
                )
        repository.delete(enrollment)
        session.commit()
        return json_response(204, {}, event=event)
