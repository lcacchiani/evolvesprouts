"""Admin location API handlers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_request import (
    encode_cursor,
    parse_body,
    parse_cursor,
    parse_uuid,
    query_param,
)
from app.api.admin_validators import MAX_ADDRESS_LENGTH, validate_string_length
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import Location
from app.db.repositories import GeographicAreaRepository, LocationRepository
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response


def handle_admin_locations_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/locations routes."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "locations":
        return json_response(404, {"error": "Not found"}, event=event)

    if len(parts) == 2:
        if method == "GET":
            return _list_locations(event)
        if method == "POST":
            return _create_location(event)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    location_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_location(event, location_id)
        if method == "PUT":
            return _update_location(event, location_id, partial=False)
        if method == "PATCH":
            return _update_location(event, location_id, partial=True)
        if method == "DELETE":
            return _delete_location(event, location_id)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_locations(event: Mapping[str, Any]) -> dict[str, Any]:
    limit = _parse_limit(event)
    cursor = parse_cursor(query_param(event, "cursor"))
    area_id = _parse_optional_uuid(query_param(event, "area_id"), field="area_id")

    with Session(get_engine()) as session:
        location_repo = LocationRepository(session)
        if area_id is not None:
            rows = list(location_repo.find_by_area(area_id, limit=limit + 1))
        else:
            rows = list(location_repo.get_all(limit=limit + 1, cursor=cursor))
        has_more = len(rows) > limit
        rows = rows[:limit]
        next_cursor = encode_cursor(rows[-1].id) if has_more and rows else None
        return json_response(
            200,
            {
                "items": [_serialize_location(location) for location in rows],
                "next_cursor": next_cursor,
            },
            event=event,
        )


def _create_location(event: Mapping[str, Any]) -> dict[str, Any]:
    body = parse_body(event)
    identity = extract_identity(event)
    request_id = _request_id(event)

    area_id_raw = body.get("area_id")
    if area_id_raw is None:
        raise ValidationError("area_id is required", field="area_id")
    area_id = parse_uuid(str(area_id_raw))
    address = _parse_address(body.get("address"), required=False)
    lat = _parse_optional_float(body.get("lat"), field="lat")
    lng = _parse_optional_float(body.get("lng"), field="lng")
    _validate_coordinates(lat=lat, lng=lng)

    with Session(get_engine()) as session:
        set_audit_context(
            session,
            user_id=identity.user_sub or "",
            request_id=request_id,
        )
        geo_repo = GeographicAreaRepository(session)
        if geo_repo.get_by_id(area_id) is None:
            raise ValidationError("area_id not found", field="area_id")

        location_repo = LocationRepository(session)
        location = Location(
            area_id=area_id,
            address=address,
            lat=lat,
            lng=lng,
        )
        location = location_repo.create(location)
        session.commit()
        return json_response(
            201,
            {"location": _serialize_location(location)},
            event=event,
        )


def _get_location(event: Mapping[str, Any], location_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        location_repo = LocationRepository(session)
        location = location_repo.get_by_id(location_id)
        if location is None:
            raise NotFoundError("Location", str(location_id))
        return json_response(
            200,
            {"location": _serialize_location(location)},
            event=event,
        )


def _update_location(
    event: Mapping[str, Any],
    location_id: UUID,
    *,
    partial: bool,
) -> dict[str, Any]:
    body = parse_body(event)
    identity = extract_identity(event)
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(
            session,
            user_id=identity.user_sub or "",
            request_id=request_id,
        )
        geo_repo = GeographicAreaRepository(session)
        location_repo = LocationRepository(session)
        location = location_repo.get_by_id(location_id)
        if location is None:
            raise NotFoundError("Location", str(location_id))

        if not partial:
            if "area_id" not in body:
                raise ValidationError("area_id is required", field="area_id")

        if "area_id" in body:
            area_id = parse_uuid(str(body["area_id"]))
            if geo_repo.get_by_id(area_id) is None:
                raise ValidationError("area_id not found", field="area_id")
            location.area_id = area_id  # type: ignore[assignment]

        if "address" in body:
            location.address = _parse_address(body.get("address"), required=False)

        if "lat" in body:
            location.lat = _parse_optional_float(body.get("lat"), field="lat")  # type: ignore[assignment]
        if "lng" in body:
            location.lng = _parse_optional_float(body.get("lng"), field="lng")  # type: ignore[assignment]
        _validate_coordinates(lat=location.lat, lng=location.lng)

        location = location_repo.update(location)
        session.commit()
        return json_response(
            200,
            {"location": _serialize_location(location)},
            event=event,
        )


def _delete_location(event: Mapping[str, Any], location_id: UUID) -> dict[str, Any]:
    identity = extract_identity(event)
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(
            session,
            user_id=identity.user_sub or "",
            request_id=request_id,
        )
        location_repo = LocationRepository(session)
        location = location_repo.get_by_id(location_id)
        if location is None:
            raise NotFoundError("Location", str(location_id))
        location_repo.delete(location)
        session.commit()
        return json_response(204, {}, event=event)


def _serialize_location(location: Location) -> dict[str, Any]:
    return {
        "id": str(location.id),
        "area_id": str(location.area_id),
        "address": location.address,
        "lat": location.lat,
        "lng": location.lng,
        "created_at": location.created_at,
        "updated_at": location.updated_at,
    }


def _parse_limit(event: Mapping[str, Any]) -> int:
    raw_value = query_param(event, "limit")
    if not raw_value:
        return 50
    try:
        limit = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValidationError("limit must be an integer", field="limit") from exc
    if limit < 1 or limit > 100:
        raise ValidationError("limit must be between 1 and 100", field="limit")
    return limit


def _parse_optional_uuid(value: str | None, *, field: str) -> UUID | None:
    if value is None or value.strip() == "":
        return None
    try:
        return parse_uuid(value.strip())
    except ValidationError as exc:
        raise ValidationError(exc.message, field=field) from exc


def _parse_address(value: Any, *, required: bool) -> str | None:
    validated = validate_string_length(
        value,
        "address",
        max_length=MAX_ADDRESS_LENGTH,
        required=required,
    )
    return validated


def _parse_optional_float(value: Any, *, field: str) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be a valid number", field=field) from exc


def _validate_coordinates(*, lat: Any, lng: Any) -> None:
    if lat is not None and (lat < -90 or lat > 90):
        raise ValidationError("lat must be between -90 and 90", field="lat")
    if lng is not None and (lng < -180 or lng > 180):
        raise ValidationError("lng must be between -180 and 180", field="lng")


def _request_id(event: Mapping[str, Any]) -> str:
    request_context = event.get("requestContext")
    if isinstance(request_context, Mapping):
        request_id = request_context.get("requestId")
        if isinstance(request_id, str):
            return request_id
    return ""
