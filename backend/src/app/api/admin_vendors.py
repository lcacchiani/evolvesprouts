"""Admin vendor API handlers backed by organizations."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_request import (
    encode_cursor,
    parse_body,
    parse_cursor,
    parse_uuid,
    query_param,
)
from app.api.admin_validators import MAX_NAME_LENGTH, validate_string_length
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import Organization, OrganizationType, RelationshipType
from app.db.repositories import OrganizationRepository
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response

_DEFAULT_LIMIT = 25
_MAX_LIMIT = 100


def handle_admin_vendors_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/vendors routes."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "vendors":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method == "GET":
            return _list_vendors(event)
        if method == "POST":
            return _create_vendor(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    vendor_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_vendor(event, vendor_id=vendor_id)
        if method == "PATCH":
            return _update_vendor(event, vendor_id=vendor_id, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_vendors(event: Mapping[str, Any]) -> dict[str, Any]:
    limit = _parse_limit(event)
    cursor = parse_cursor(query_param(event, "cursor"))
    query = validate_string_length(
        query_param(event, "query"),
        "query",
        max_length=255,
        required=False,
    )
    active = _parse_active(query_param(event, "active"))

    with Session(get_engine()) as session:
        repository = OrganizationRepository(session)
        rows = repository.list_vendors(
            limit=limit + 1,
            cursor=cursor,
            query=query,
            active=active,
        )
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        next_cursor = (
            encode_cursor(page_rows[-1].id) if has_more and page_rows else None
        )
        total_count = repository.count_vendors(query=query, active=active)
        return json_response(
            200,
            {
                "items": [_serialize_vendor(row) for row in page_rows],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _create_vendor(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    body = parse_body(event)
    name = validate_string_length(
        body.get("name"),
        "name",
        max_length=MAX_NAME_LENGTH,
        required=True,
    )
    website = validate_string_length(
        body.get("website"),
        "website",
        max_length=500,
        required=False,
    )
    active = _parse_optional_bool(body.get("active"), field="active")
    now = datetime.now(UTC)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        repository = OrganizationRepository(session)
        created = repository.create(
            Organization(
                name=name or "",
                organization_type=OrganizationType.OTHER,
                relationship_type=RelationshipType.VENDOR,
                website=website,
                archived_at=None if active is not False else now,
            )
        )
        session.commit()
        return json_response(
            201,
            {"vendor": _serialize_vendor(created)},
            event=event,
        )


def _get_vendor(event: Mapping[str, Any], *, vendor_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = OrganizationRepository(session)
        vendor = repository.get_vendor_by_id(vendor_id)
        if vendor is None:
            raise NotFoundError("Vendor", str(vendor_id))
        return json_response(200, {"vendor": _serialize_vendor(vendor)}, event=event)


def _update_vendor(
    event: Mapping[str, Any],
    *,
    vendor_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    now = datetime.now(UTC)
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        repository = OrganizationRepository(session)
        vendor = repository.get_vendor_by_id(vendor_id)
        if vendor is None:
            raise NotFoundError("Vendor", str(vendor_id))

        if "name" in body:
            vendor.name = (
                validate_string_length(
                    body.get("name"),
                    "name",
                    max_length=MAX_NAME_LENGTH,
                    required=True,
                )
                or vendor.name
            )
        if "website" in body:
            vendor.website = validate_string_length(
                body.get("website"),
                "website",
                max_length=500,
                required=False,
            )
        if "active" in body:
            active = _parse_optional_bool(body.get("active"), field="active")
            if active is None:
                raise ValidationError("active is required", field="active")
            vendor.archived_at = None if active else now

        updated = repository.update(vendor)
        session.commit()
        return json_response(200, {"vendor": _serialize_vendor(updated)}, event=event)


def _serialize_vendor(vendor: Organization) -> dict[str, Any]:
    return {
        "id": str(vendor.id),
        "name": vendor.name,
        "website": vendor.website,
        "active": vendor.archived_at is None,
        "archived_at": vendor.archived_at,
        "created_at": vendor.created_at,
        "updated_at": vendor.updated_at,
    }


def _parse_limit(event: Mapping[str, Any]) -> int:
    raw = query_param(event, "limit")
    if raw is None or raw == "":
        return _DEFAULT_LIMIT
    try:
        parsed = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError("limit must be an integer", field="limit") from exc
    if parsed < 1 or parsed > _MAX_LIMIT:
        raise ValidationError("limit must be between 1 and 100", field="limit")
    return parsed


def _parse_active(raw: str | None) -> bool | None:
    if raw is None or raw.strip() == "":
        return None
    normalized = raw.strip().lower()
    if normalized in {"true", "1"}:
        return True
    if normalized in {"false", "0"}:
        return False
    raise ValidationError("active must be true or false", field="active")


def _parse_optional_bool(value: Any, *, field: str) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1"}:
            return True
        if normalized in {"false", "0"}:
            return False
    raise ValidationError(f"{field} must be true or false", field=field)


def _request_id(event: Mapping[str, Any]) -> str:
    request_context = event.get("requestContext")
    if isinstance(request_context, Mapping):
        request_id = request_context.get("requestId")
        if isinstance(request_id, str):
            return request_id.strip()
    return ""
