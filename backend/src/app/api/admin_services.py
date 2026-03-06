"""Admin service API handlers."""

from __future__ import annotations

import os
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.api.admin_request import parse_body, parse_uuid
from app.api.admin_service_instances import handle_admin_service_instances_request
from app.api.admin_services_common import (
    encode_service_cursor,
    parse_create_service_payload,
    parse_service_filters,
    parse_update_service_payload,
    request_id,
    serialize_service_detail,
    serialize_service_summary,
)
from app.api.admin_services_payload_utils import parse_service_type_details
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import (
    ConsultationDetails,
    ConsultationFormat,
    EventCategory,
    EventDetails,
    Service,
    ServiceAsset,
    ServiceTag,
    ServiceType,
    TrainingCourseDetails,
)
from app.db.repositories import ServiceRepository
from app.exceptions import NotFoundError, ValidationError
from app.services.aws_clients import get_s3_client
from app.utils import json_response, require_env


def handle_admin_services_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/services routes."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "services":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method == "GET":
            return _list_services(event)
        if method == "POST":
            return _create_service(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    service_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_service(event, service_id=service_id)
        if method == "PUT":
            return _update_service(
                event, service_id=service_id, actor_sub=identity.user_sub, partial=False
            )
        if method == "PATCH":
            return _update_service(
                event, service_id=service_id, actor_sub=identity.user_sub, partial=True
            )
        if method == "DELETE":
            return _delete_service(
                event, service_id=service_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) >= 4 and parts[3] == "instances":
        return handle_admin_service_instances_request(event, method, path, service_id)

    if len(parts) == 4 and parts[3] == "cover-image":
        if method != "POST":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _create_cover_image_upload(
            event, service_id=service_id, actor_sub=identity.user_sub
        )

    return json_response(404, {"error": "Not found"}, event=event)


def _list_services(event: Mapping[str, Any]) -> dict[str, Any]:
    filters = parse_service_filters(event)
    limit = filters["limit"]
    with Session(get_engine()) as session:
        repository = ServiceRepository(session)
        rows = repository.list_services(
            limit=limit + 1,
            service_type=filters["service_type"],
            status=filters["status"],
            search=filters["search"],
            cursor_created_at=filters["cursor_created_at"],
            cursor_id=filters["cursor_id"],
        )
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        next_cursor = (
            encode_service_cursor(page_rows[-1]) if has_more and page_rows else None
        )
        total_count = repository.count_services(
            service_type=filters["service_type"],
            status=filters["status"],
            search=filters["search"],
        )
        return json_response(
            200,
            {
                "items": [serialize_service_summary(row) for row in page_rows],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _create_service(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    body = parse_body(event)
    payload = parse_create_service_payload(body)
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = ServiceRepository(session)
        service = Service(
            service_type=payload["service_type"],
            title=payload["title"],
            description=payload["description"],
            cover_image_s3_key=payload["cover_image_s3_key"],
            delivery_mode=payload["delivery_mode"],
            status=payload["status"],
            created_by=actor_sub,
        )
        details = _build_service_type_details(
            service_type=payload["service_type"],
            parsed_details=payload["type_details"],
        )
        created = repository.create_service(service, details)
        created.service_tags = [
            ServiceTag(tag_id=tag_id) for tag_id in payload["tag_ids"]
        ]
        created.service_assets = [
            ServiceAsset(asset_id=asset_id) for asset_id in payload["asset_ids"]
        ]
        repository.update_service(created)
        session.commit()
        with_details = repository.get_by_id_with_details(created.id)
        if with_details is None:
            raise NotFoundError("Service", str(created.id))
        return json_response(
            201,
            {"service": serialize_service_detail(with_details)},
            event=event,
        )


def _get_service(event: Mapping[str, Any], *, service_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = ServiceRepository(session)
        service = repository.get_by_id_with_details(service_id)
        if service is None:
            raise NotFoundError("Service", str(service_id))
        return json_response(
            200,
            {"service": serialize_service_detail(service)},
            event=event,
        )


def _update_service(
    event: Mapping[str, Any],
    *,
    service_id: UUID,
    actor_sub: str,
    partial: bool,
) -> dict[str, Any]:
    body = parse_body(event)
    payload = parse_update_service_payload(body, partial=partial)
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = ServiceRepository(session)
        service = repository.get_by_id_with_details(service_id)
        if service is None:
            raise NotFoundError("Service", str(service_id))

        if "title" in payload:
            service.title = payload["title"]
        if "description" in payload:
            service.description = payload["description"]
        if "cover_image_s3_key" in payload:
            service.cover_image_s3_key = payload["cover_image_s3_key"]
        if "delivery_mode" in payload:
            service.delivery_mode = payload["delivery_mode"]
        if "status" in payload:
            service.status = payload["status"]
        if "tag_ids" in payload:
            service.service_tags = [
                ServiceTag(tag_id=tag_id) for tag_id in payload["tag_ids"]
            ]
        if "asset_ids" in payload:
            service.service_assets = [
                ServiceAsset(asset_id=asset_id) for asset_id in payload["asset_ids"]
            ]
        if "type_details" in payload:
            parsed_type_details = parse_service_type_details(
                service.service_type, payload["type_details"]
            )
            parsed_details = _build_service_type_details(
                service_type=service.service_type,
                parsed_details=parsed_type_details,
            )
            _apply_service_type_details(service=service, details=parsed_details)

        updated = repository.update_service(service)
        session.commit()
        with_details = repository.get_by_id_with_details(updated.id)
        if with_details is None:
            raise NotFoundError("Service", str(updated.id))
        return json_response(
            200,
            {"service": serialize_service_detail(with_details)},
            event=event,
        )


def _delete_service(
    event: Mapping[str, Any],
    *,
    service_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = ServiceRepository(session)
        service = repository.get_by_id(service_id)
        if service is None:
            raise NotFoundError("Service", str(service_id))
        repository.delete(service)
        session.commit()
        return json_response(204, {}, event=event)


def _create_cover_image_upload(
    event: Mapping[str, Any],
    *,
    service_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    file_name = str(body.get("file_name") or "").strip()
    if not file_name:
        raise ValidationError("file_name is required", field="file_name")
    content_type = (
        str(body.get("content_type") or "").strip() or "application/octet-stream"
    )
    normalized_file_name = _sanitize_file_name(file_name)
    s3_key = f"media/services/{service_id}/cover/{uuid4()}-{normalized_file_name}"

    media_bucket = os.getenv("MEDIA_BUCKET_NAME") or require_env(
        "CLIENT_ASSETS_BUCKET_NAME"
    )
    ttl = _presign_ttl_seconds()
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl)
    s3_client = get_s3_client()
    upload_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": media_bucket,
            "Key": s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=ttl,
        HttpMethod="PUT",
    )

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id(event))
        repository = ServiceRepository(session)
        service = repository.get_by_id(service_id)
        if service is None:
            raise NotFoundError("Service", str(service_id))
        service.cover_image_s3_key = s3_key
        repository.update_service(service)
        session.commit()

    return json_response(
        200,
        {
            "upload_url": upload_url,
            "upload_method": "PUT",
            "upload_headers": {"Content-Type": content_type},
            "s3_key": s3_key,
            "expires_at": expires_at.isoformat(),
            "service": {"id": str(service_id), "cover_image_s3_key": s3_key},
        },
        event=event,
    )


def _build_service_type_details(
    *, service_type: ServiceType, parsed_details: Mapping[str, Any]
) -> Any:
    if service_type == ServiceType.TRAINING_COURSE:
        return TrainingCourseDetails(
            pricing_unit=parsed_details["pricing_unit"],
            default_price=parsed_details["default_price"],
            default_currency=parsed_details["default_currency"],
        )
    if service_type == ServiceType.EVENT:
        return EventDetails(
            event_category=EventCategory(parsed_details["event_category"].value)
        )
    return ConsultationDetails(
        consultation_format=ConsultationFormat(
            parsed_details["consultation_format"].value
        ),
        max_group_size=parsed_details["max_group_size"],
        duration_minutes=parsed_details["duration_minutes"] or 60,
        pricing_model=parsed_details["pricing_model"],
        default_hourly_rate=parsed_details["default_hourly_rate"],
        default_package_price=parsed_details["default_package_price"],
        default_package_sessions=parsed_details["default_package_sessions"],
        default_currency=parsed_details["default_currency"],
        calendly_url=parsed_details["calendly_url"],
    )


def _apply_service_type_details(*, service: Service, details: Any) -> None:
    if isinstance(details, TrainingCourseDetails):
        service.training_course_details = details
        service.event_details = None
        service.consultation_details = None
    elif isinstance(details, EventDetails):
        service.event_details = details
        service.training_course_details = None
        service.consultation_details = None
    else:
        service.consultation_details = details
        service.training_course_details = None
        service.event_details = None


def _sanitize_file_name(file_name: str) -> str:
    safe = "".join(
        char if char.isalnum() or char in {".", "-", "_"} else "-"
        for char in file_name.strip()
    )
    safe = safe.strip("-")
    return safe or "cover-image"


def _presign_ttl_seconds() -> int:
    raw = os.getenv("ASSET_PRESIGN_TTL_SECONDS", "900").strip()
    try:
        parsed = int(raw)
    except ValueError as exc:
        raise ValidationError("ASSET_PRESIGN_TTL_SECONDS must be an integer") from exc
    return max(60, min(3600, parsed))
