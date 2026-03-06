"""Admin service-instance API handlers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_enrollments import handle_admin_enrollments_request
from app.api.admin_request import parse_body, parse_uuid
from app.api.admin_services_common import (
    encode_instance_cursor,
    parse_instance_filters,
    parse_create_instance_payload,
    parse_update_instance_payload,
    request_id,
    serialize_instance,
)
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import (
    ConsultationInstanceDetails,
    EventTicketTier,
    InstanceSessionSlot,
    ServiceInstance,
    ServiceType,
    TrainingFormat,
    TrainingInstanceDetails,
)
from app.db.repositories import ServiceInstanceRepository, ServiceRepository
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)


def handle_admin_service_instances_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
    service_id: UUID,
) -> dict[str, Any]:
    """Handle nested service-instance routes."""
    logger.info(
        "Handling admin service-instances route",
        extra={"method": method, "path": path, "service_id": str(service_id)},
    )
    parts = split_route_parts(path)
    if len(parts) < 4 or parts[0] != "admin" or parts[1] != "services":
        return json_response(404, {"error": "Not found"}, event=event)
    if parts[3] != "instances":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 4:
        if method == "GET":
            return _list_instances(event, service_id=service_id)
        if method == "POST":
            return _create_instance(
                event, service_id=service_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    instance_id = parse_uuid(parts[4])
    if len(parts) == 5:
        if method == "GET":
            return _get_instance(event, service_id=service_id, instance_id=instance_id)
        if method == "PUT":
            return _update_instance(
                event,
                service_id=service_id,
                instance_id=instance_id,
                actor_sub=identity.user_sub,
            )
        if method == "DELETE":
            return _delete_instance(
                event,
                service_id=service_id,
                instance_id=instance_id,
                actor_sub=identity.user_sub,
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) >= 6 and parts[5] == "enrollments":
        return handle_admin_enrollments_request(event, method, path, instance_id)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_instances(event: Mapping[str, Any], *, service_id: UUID) -> dict[str, Any]:
    filters = parse_instance_filters(event)
    limit = filters["limit"]
    logger.info(
        "Listing service instances",
        extra={"service_id": str(service_id), "limit": limit},
    )
    with Session(get_engine()) as session:
        service_repository = ServiceRepository(session)
        service = service_repository.get_by_id(service_id)
        if service is None:
            raise NotFoundError("Service", str(service_id))

        repository = ServiceInstanceRepository(session)
        rows = repository.list_instances(
            service_id=service_id,
            limit=limit + 1,
            status=filters["status"],
            cursor_created_at=filters["cursor_created_at"],
            cursor_id=filters["cursor_id"],
        )
        total_count = repository.count_instances(
            service_id=service_id,
            status=filters["status"],
        )
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        next_cursor = (
            encode_instance_cursor(page_rows[-1]) if has_more and page_rows else None
        )
        return json_response(
            200,
            {
                "items": [serialize_instance(row) for row in page_rows],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _create_instance(
    event: Mapping[str, Any],
    *,
    service_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    logger.info(
        "Creating service instance",
        extra={"service_id": str(service_id), "actor_sub": actor_sub},
    )
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        service_repository = ServiceRepository(session)
        instance_repository = ServiceInstanceRepository(session)

        service = service_repository.get_by_id(service_id)
        if service is None:
            raise NotFoundError("Service", str(service_id))
        payload = parse_create_instance_payload(body, service)

        instance = ServiceInstance(
            service_id=service_id,
            title=payload["title"],
            description=payload["description"],
            cover_image_s3_key=payload["cover_image_s3_key"],
            status=payload["status"],
            delivery_mode=payload["delivery_mode"],
            location_id=payload["location_id"],
            max_capacity=payload["max_capacity"],
            waitlist_enabled=payload["waitlist_enabled"],
            instructor_id=payload["instructor_id"],
            notes=payload["notes"],
            created_by=actor_sub,
        )
        type_details = _build_instance_type_details(
            service.service_type, payload["type_details"]
        )
        slots = [
            InstanceSessionSlot(
                location_id=item["location_id"],
                starts_at=item["starts_at"],
                ends_at=item["ends_at"],
                sort_order=item["sort_order"],
            )
            for item in payload["session_slots"]
        ]
        created = instance_repository.create_instance(instance, type_details, slots)
        session.commit()
        with_details = instance_repository.get_by_id_with_details(created.id)
        if with_details is None:
            raise NotFoundError("ServiceInstance", str(created.id))
        return json_response(
            201, {"instance": serialize_instance(with_details)}, event=event
        )


def _get_instance(
    event: Mapping[str, Any],
    *,
    service_id: UUID,
    instance_id: UUID,
) -> dict[str, Any]:
    logger.info(
        "Getting service instance",
        extra={"service_id": str(service_id), "instance_id": str(instance_id)},
    )
    with Session(get_engine()) as session:
        repository = ServiceInstanceRepository(session)
        instance = repository.get_by_id_with_details(instance_id)
        if instance is None or instance.service_id != service_id:
            raise NotFoundError("ServiceInstance", str(instance_id))
        return json_response(
            200, {"instance": serialize_instance(instance)}, event=event
        )


def _update_instance(
    event: Mapping[str, Any],
    *,
    service_id: UUID,
    instance_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    logger.info(
        "Updating service instance",
        extra={
            "service_id": str(service_id),
            "instance_id": str(instance_id),
            "actor_sub": actor_sub,
        },
    )
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        service_repository = ServiceRepository(session)
        instance_repository = ServiceInstanceRepository(session)

        service = service_repository.get_by_id(service_id)
        if service is None:
            raise NotFoundError("Service", str(service_id))
        instance = instance_repository.get_by_id_with_details(instance_id)
        if instance is None or instance.service_id != service_id:
            raise NotFoundError("ServiceInstance", str(instance_id))
        payload = parse_update_instance_payload(body, service)

        if "title" in payload:
            instance.title = payload["title"]
        if "description" in payload:
            instance.description = payload["description"]
        if "cover_image_s3_key" in payload:
            instance.cover_image_s3_key = payload["cover_image_s3_key"]
        if "status" in payload:
            instance.status = payload["status"]
        if "delivery_mode" in payload:
            instance.delivery_mode = payload["delivery_mode"]
        if "location_id" in payload:
            instance.location_id = payload["location_id"]
        if "max_capacity" in payload:
            instance.max_capacity = payload["max_capacity"]
        if "waitlist_enabled" in payload:
            instance.waitlist_enabled = payload["waitlist_enabled"]
        if "instructor_id" in payload:
            instance.instructor_id = payload["instructor_id"]
        if "notes" in payload:
            instance.notes = payload["notes"]
        if "session_slots" in payload:
            instance.session_slots.clear()
            for item in payload["session_slots"]:
                instance.session_slots.append(
                    InstanceSessionSlot(
                        location_id=item["location_id"],
                        starts_at=item["starts_at"],
                        ends_at=item["ends_at"],
                        sort_order=item["sort_order"],
                    )
                )
        if "type_details" in payload:
            _apply_instance_type_details(
                instance=instance,
                service_type=service.service_type,
                parsed_details=payload["type_details"],
            )

        updated = instance_repository.update_instance(instance)
        session.commit()
        with_details = instance_repository.get_by_id_with_details(updated.id)
        if with_details is None:
            raise NotFoundError("ServiceInstance", str(updated.id))
        return json_response(
            200, {"instance": serialize_instance(with_details)}, event=event
        )


def _delete_instance(
    event: Mapping[str, Any],
    *,
    service_id: UUID,
    instance_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    logger.info(
        "Deleting service instance",
        extra={
            "service_id": str(service_id),
            "instance_id": str(instance_id),
            "actor_sub": actor_sub,
        },
    )
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = ServiceInstanceRepository(session)
        instance = repository.get_by_id(instance_id)
        if instance is None or instance.service_id != service_id:
            raise NotFoundError("ServiceInstance", str(instance_id))
        repository.delete(instance)
        session.commit()
        return json_response(204, {}, event=event)


def _build_instance_type_details(
    service_type: ServiceType, parsed: Mapping[str, Any]
) -> Any:
    if service_type == ServiceType.TRAINING_COURSE:
        return TrainingInstanceDetails(
            training_format=TrainingFormat(parsed["training_format"].value),
            price=parsed["price"],
            currency=parsed["currency"],
            pricing_unit=parsed["pricing_unit"],
        )
    if service_type == ServiceType.EVENT:
        return [
            EventTicketTier(
                name=tier["name"],
                description=tier["description"],
                price=tier["price"],
                currency=tier["currency"],
                max_quantity=tier["max_quantity"],
                sort_order=tier["sort_order"],
            )
            for tier in parsed["event_ticket_tiers"]
        ]
    return ConsultationInstanceDetails(
        pricing_model=parsed["pricing_model"],
        price=parsed["price"],
        currency=parsed["currency"],
        package_sessions=parsed["package_sessions"],
        calendly_event_url=parsed["calendly_event_url"],
    )


def _apply_instance_type_details(
    *,
    instance: ServiceInstance,
    service_type: ServiceType,
    parsed_details: Mapping[str, Any],
) -> None:
    details = _build_instance_type_details(service_type, parsed_details)
    if service_type == ServiceType.TRAINING_COURSE:
        instance.training_details = details
        instance.consultation_details = None
        instance.ticket_tiers.clear()
    elif service_type == ServiceType.EVENT:
        instance.ticket_tiers.clear()
        for tier in details:
            instance.ticket_tiers.append(tier)
        instance.training_details = None
        instance.consultation_details = None
    else:
        instance.consultation_details = details
        instance.training_details = None
        instance.ticket_tiers.clear()
