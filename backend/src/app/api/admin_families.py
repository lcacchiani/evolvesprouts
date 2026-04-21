"""Admin CRM families API."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_crm_helpers import (
    assert_contact_can_join_family,
    crm_request_id,
    ensure_location_exists,
    parse_active_filter,
    parse_crm_limit,
    parse_crm_relationship_type,
    parse_optional_bool_body,
    replace_family_tags,
)
from app.api.admin_crm_serializers import serialize_family_summary
from app.api.admin_request import (
    encode_cursor,
    parse_body,
    parse_cursor,
    parse_uuid,
    query_param,
)
from app.api.admin_services_payload_utils import parse_optional_uuid, parse_uuid_list
from app.api.admin_validators import validate_string_length
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import Contact, Family, FamilyMember, FamilyRole
from app.db.repositories import FamilyRepository
from app.exceptions import DatabaseError, NotFoundError, ValidationError
from app.utils import json_response
from app.utils.logging import get_logger

_DEFAULT_LIMIT = 25
logger = get_logger(__name__)


def handle_admin_families_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/families routes."""
    logger.info(
        "Handling admin CRM families route",
        extra={"method": method, "path": path},
    )
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "families":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method == "GET":
            return _list_families(event)
        if method == "POST":
            return _create_family(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    family_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_family(event, family_id=family_id)
        if method == "PATCH":
            return _update_family(
                event, family_id=family_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 4 and parts[3] == "members":
        if method == "POST":
            return _add_family_member(
                event, family_id=family_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 5 and parts[3] == "members":
        member_id = parse_uuid(parts[4])
        if method == "DELETE":
            return _remove_family_member(
                event,
                family_id=family_id,
                member_id=member_id,
                actor_sub=identity.user_sub,
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _parse_family_role(value: Any, *, field: str) -> FamilyRole:
    if value is None or str(value).strip() == "":
        raise ValidationError(f"{field} is required", field=field)
    try:
        return FamilyRole(str(value).strip().lower())
    except ValueError as exc:
        raise ValidationError(f"Invalid {field}", field=field) from exc


def _list_families(event: Mapping[str, Any]) -> dict[str, Any]:
    limit = parse_crm_limit(event, default=_DEFAULT_LIMIT)
    cursor = parse_cursor(query_param(event, "cursor"))
    query = validate_string_length(
        query_param(event, "query"),
        "query",
        max_length=255,
        required=False,
    )
    active = parse_active_filter(query_param(event, "active"))

    with Session(get_engine()) as session:
        repository = FamilyRepository(session)
        rows = repository.list_for_admin(
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
        total_count = repository.count_for_admin(query=query, active=active)
        return json_response(
            200,
            {
                "items": [serialize_family_summary(r) for r in page_rows],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _get_family(event: Mapping[str, Any], *, family_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = FamilyRepository(session)
        family = repository.get_by_id_for_admin(family_id)
        if family is None:
            raise NotFoundError("Family", str(family_id))
        return json_response(
            200,
            {"family": serialize_family_summary(family)},
            event=event,
        )


def _create_family(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    body = parse_body(event)
    family_name = validate_string_length(
        body.get("family_name"),
        "family_name",
        max_length=150,
        required=True,
    )
    relationship_type = parse_crm_relationship_type(
        body.get("relationship_type"), field="relationship_type"
    )
    location_id = parse_optional_uuid(body.get("location_id"), "location_id")
    tag_ids = parse_uuid_list(body.get("tag_ids"), "tag_ids")

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        ensure_location_exists(session, location_id)
        repository = FamilyRepository(session)
        family = Family(
            family_name=family_name or "",
            relationship_type=relationship_type,
            location_id=location_id,
        )
        created = repository.create(family)
        if tag_ids:
            replace_family_tags(session, family_id=created.id, tag_ids=tag_ids)
        session.commit()
        loaded = repository.get_by_id_for_admin(created.id)
        if loaded is None:
            raise DatabaseError("Failed to load family after create")
        return json_response(
            201,
            {"family": serialize_family_summary(loaded)},
            event=event,
        )


def _update_family(
    event: Mapping[str, Any],
    *,
    family_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    now = datetime.now(UTC)
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        repository = FamilyRepository(session)
        family = repository.get_by_id_for_admin(family_id)
        if family is None:
            raise NotFoundError("Family", str(family_id))

        if "family_name" in body:
            family.family_name = (
                validate_string_length(
                    body.get("family_name"),
                    "family_name",
                    max_length=150,
                    required=True,
                )
                or family.family_name
            )
        if "relationship_type" in body:
            family.relationship_type = parse_crm_relationship_type(
                body.get("relationship_type"),
                field="relationship_type",
            )
        if "location_id" in body:
            loc = parse_optional_uuid(body.get("location_id"), "location_id")
            ensure_location_exists(session, loc)
            family.location_id = loc
        if "active" in body:
            active = parse_optional_bool_body(body.get("active"), field="active")
            if active is None:
                raise ValidationError("active is required", field="active")
            family.archived_at = None if active else now
        if "tag_ids" in body:
            tag_ids = parse_uuid_list(body.get("tag_ids"), "tag_ids")
            replace_family_tags(session, family_id=family.id, tag_ids=tag_ids)

        repository.update(family)
        session.commit()
        loaded = repository.get_by_id_for_admin(family_id)
        if loaded is None:
            raise DatabaseError("Failed to load family after update")
        return json_response(
            200,
            {"family": serialize_family_summary(loaded)},
            event=event,
        )


def _add_family_member(
    event: Mapping[str, Any],
    *,
    family_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    contact_id = parse_uuid(str(body.get("contact_id")))
    role = _parse_family_role(body.get("role"), field="role")
    is_primary = body.get("is_primary_contact")
    if is_primary is None:
        is_primary_contact = False
    elif isinstance(is_primary, bool):
        is_primary_contact = is_primary
    elif isinstance(is_primary, str) and is_primary.strip().lower() in {"true", "1"}:
        is_primary_contact = True
    elif isinstance(is_primary, str) and is_primary.strip().lower() in {"false", "0"}:
        is_primary_contact = False
    else:
        raise ValidationError(
            "is_primary_contact must be true or false",
            field="is_primary_contact",
        )

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        repository = FamilyRepository(session)
        family = repository.get_by_id_for_admin(family_id)
        if family is None:
            raise NotFoundError("Family", str(family_id))
        contact = session.get(Contact, contact_id)
        if contact is None:
            raise ValidationError("contact_id not found", field="contact_id")
        assert_contact_can_join_family(
            session, contact_id=contact_id, family_id=family_id
        )

        member = FamilyMember(
            family_id=family_id,
            contact_id=contact_id,
            role=role,
            is_primary_contact=is_primary_contact,
        )
        session.add(member)
        contact.location_id = None
        session.commit()
        session.refresh(member)
        loaded = repository.get_by_id_for_admin(family_id)
        if loaded is None:
            raise DatabaseError("Failed to load family after adding member")
        return json_response(
            201,
            {"family": serialize_family_summary(loaded)},
            event=event,
        )


def _remove_family_member(
    event: Mapping[str, Any],
    *,
    family_id: UUID,
    member_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        repository = FamilyRepository(session)
        family = repository.get_by_id_for_admin(family_id)
        if family is None:
            raise NotFoundError("Family", str(family_id))
        member = session.get(FamilyMember, member_id)
        if member is None or member.family_id != family_id:
            raise NotFoundError("FamilyMember", str(member_id))
        session.delete(member)
        session.commit()
        loaded = repository.get_by_id_for_admin(family_id)
        if loaded is None:
            raise DatabaseError("Failed to load family after removing member")
        return json_response(
            200,
            {"family": serialize_family_summary(loaded)},
            event=event,
        )
