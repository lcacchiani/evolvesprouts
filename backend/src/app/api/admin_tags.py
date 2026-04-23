"""Admin CRM tags catalog API."""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.admin_entities_helpers import serialize_tag_ref
from app.api.admin_request import parse_body, parse_uuid, query_param
from app.api.admin_validators import validate_string_length
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import (
    AssetTag,
    ContactTag,
    FamilyTag,
    OrganizationTag,
    ServiceInstanceTag,
    ServiceTag,
    Tag,
)
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)

_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def handle_admin_tags_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/tags routes."""
    logger.info(
        "Handling admin tags route",
        extra={"method": method, "path": path},
    )
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "tags":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method == "GET":
            return _list_tags(event)
        if method == "POST":
            return _create_tag(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    tag_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_tag(event, tag_id=tag_id)
        if method == "PATCH":
            return _update_tag(event, tag_id=tag_id, actor_sub=identity.user_sub)
        if method == "DELETE":
            return _delete_tag(event, tag_id=tag_id, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _tag_usage_count(session: Session, tag_id: UUID) -> int:
    total = 0
    for model in (
        ContactTag,
        FamilyTag,
        OrganizationTag,
        AssetTag,
        ServiceTag,
        ServiceInstanceTag,
    ):
        count = session.scalar(
            select(func.count()).select_from(model).where(model.tag_id == tag_id)
        )
        total += int(count or 0)
    return total


def _serialize_admin_tag(session: Session, tag: Tag) -> dict[str, Any]:
    data = serialize_tag_ref(tag)
    data["description"] = tag.description
    data["archived_at"] = (
        tag.archived_at.isoformat() if tag.archived_at is not None else None
    )
    data["usage_count"] = _tag_usage_count(session, tag.id)
    return data


def _parse_include_archived(event: Mapping[str, Any]) -> bool:
    raw = query_param(event, "include_archived")
    if raw is None or raw.strip() == "":
        return False
    normalized = raw.strip().lower()
    if normalized in {"true", "1"}:
        return True
    if normalized in {"false", "0"}:
        return False
    raise ValidationError(
        "include_archived must be true or false", field="include_archived"
    )


def _parse_optional_hex_color(value: Any, *, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string or null", field=field)
    stripped = value.strip()
    if stripped == "":
        return None
    if not _HEX_COLOR_RE.match(stripped):
        raise ValidationError(
            f"{field} must be a #RRGGBB hex color or null", field=field
        )
    return stripped


def _list_tags(event: Mapping[str, Any]) -> dict[str, Any]:
    include_archived = _parse_include_archived(event)
    with Session(get_engine()) as session:
        stmt = select(Tag).order_by(func.lower(Tag.name))
        if not include_archived:
            stmt = stmt.where(Tag.archived_at.is_(None))
        tags = list(session.execute(stmt).scalars().all())
        return json_response(
            200,
            {"items": [_serialize_admin_tag(session, t) for t in tags]},
            event=event,
        )


def _get_tag(event: Mapping[str, Any], *, tag_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        tag = session.get(Tag, tag_id)
        if tag is None:
            raise NotFoundError("Tag", str(tag_id))
        return json_response(
            200,
            {"tag": _serialize_admin_tag(session, tag)},
            event=event,
        )


def _create_tag(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    body = parse_body(event)
    name = validate_string_length(
        body.get("name"),
        "name",
        max_length=100,
        required=True,
    )
    if name is None:
        raise ValidationError("name is required", field="name")
    name_stripped = name.strip()
    if not name_stripped:
        raise ValidationError("name must not be empty", field="name")
    color = _parse_optional_hex_color(body.get("color"), field="color")
    description = validate_string_length(
        body.get("description"),
        "description",
        max_length=255,
        required=False,
    )
    desc_stripped = description.strip() if description else None
    if desc_stripped == "":
        desc_stripped = None

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        tag = Tag(
            name=name_stripped,
            color=color,
            description=desc_stripped,
            created_by=actor_sub,
        )
        session.add(tag)
        try:
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            raise ValidationError(
                "A tag with this name already exists",
                field="name",
                status_code=409,
            ) from exc
        session.refresh(tag)
        return json_response(
            201,
            {"tag": _serialize_admin_tag(session, tag)},
            event=event,
        )


def _update_tag(
    event: Mapping[str, Any],
    *,
    tag_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        tag = session.get(Tag, tag_id)
        if tag is None:
            raise NotFoundError("Tag", str(tag_id))

        if "name" in body:
            name = validate_string_length(
                body.get("name"),
                "name",
                max_length=100,
                required=True,
            )
            if name is None:
                raise ValidationError("name is required", field="name")
            name_stripped = name.strip()
            if not name_stripped:
                raise ValidationError("name must not be empty", field="name")
            tag.name = name_stripped
        if "color" in body:
            tag.color = _parse_optional_hex_color(body.get("color"), field="color")
        if "description" in body:
            description = validate_string_length(
                body.get("description"),
                "description",
                max_length=255,
                required=False,
            )
            if description is None or description.strip() == "":
                tag.description = None
            else:
                tag.description = description.strip()

        try:
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            raise ValidationError(
                "A tag with this name already exists",
                field="name",
                status_code=409,
            ) from exc
        session.refresh(tag)
        return json_response(
            200,
            {"tag": _serialize_admin_tag(session, tag)},
            event=event,
        )


def _delete_tag(
    event: Mapping[str, Any],
    *,
    tag_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        tag = session.get(Tag, tag_id)
        if tag is None:
            raise NotFoundError("Tag", str(tag_id))

        usage = _tag_usage_count(session, tag_id)
        if usage > 0:
            if tag.archived_at is None:
                tag.archived_at = datetime.now(tz=UTC)
                session.commit()
            return json_response(
                200,
                {"tag": _serialize_admin_tag(session, tag)},
                event=event,
            )

        session.delete(tag)
        session.commit()
        return json_response(204, {}, event=event)


def _request_id(event: Mapping[str, Any]) -> str:
    request_context = event.get("requestContext")
    if isinstance(request_context, Mapping):
        rid = request_context.get("requestId")
        if isinstance(rid, str):
            return rid.strip()
    return ""
