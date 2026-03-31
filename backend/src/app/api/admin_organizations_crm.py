"""Admin CRM organizations API (non-vendor)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_crm_helpers import (
    ensure_location_exists,
    parse_active_filter,
    parse_crm_limit,
    parse_optional_bool_body,
    replace_organization_tags,
)
from app.api.admin_crm_serializers import serialize_organization_summary
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
from app.db.models import (
    Contact,
    Organization,
    OrganizationMember,
    OrganizationRole,
    OrganizationType,
    RelationshipType,
)
from app.db.repositories import OrganizationRepository
from app.exceptions import DatabaseError, NotFoundError, ValidationError
from app.utils import json_response

_DEFAULT_LIMIT = 25


def handle_admin_organizations_crm_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/organizations routes for CRM (excludes vendors)."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "organizations":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method == "GET":
            return _list_organizations(event)
        if method == "POST":
            return _create_organization(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    organization_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_organization(event, organization_id=organization_id)
        if method == "PATCH":
            return _update_organization(
                event, organization_id=organization_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 4 and parts[3] == "members":
        if method == "POST":
            return _add_organization_member(
                event, organization_id=organization_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 5 and parts[3] == "members":
        member_id = parse_uuid(parts[4])
        if method == "DELETE":
            return _remove_organization_member(
                event,
                organization_id=organization_id,
                member_id=member_id,
                actor_sub=identity.user_sub,
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _parse_relationship_type_crm(value: Any, *, field: str) -> RelationshipType:
    if value is None or str(value).strip() == "":
        return RelationshipType.PROSPECT
    try:
        parsed = RelationshipType(str(value).strip().lower())
    except ValueError as exc:
        raise ValidationError(f"Invalid {field}", field=field) from exc
    if parsed == RelationshipType.VENDOR:
        raise ValidationError(
            "Vendor organizations are managed under Finance",
            field=field,
        )
    return parsed


def _parse_organization_type(value: Any, *, field: str) -> OrganizationType:
    if value is None or str(value).strip() == "":
        raise ValidationError(f"{field} is required", field=field)
    try:
        return OrganizationType(str(value).strip().lower())
    except ValueError as exc:
        raise ValidationError(f"Invalid {field}", field=field) from exc


def _parse_organization_role(value: Any, *, field: str) -> OrganizationRole:
    if value is None or str(value).strip() == "":
        raise ValidationError(f"{field} is required", field=field)
    try:
        return OrganizationRole(str(value).strip().lower())
    except ValueError as exc:
        raise ValidationError(f"Invalid {field}", field=field) from exc


def _list_organizations(event: Mapping[str, Any]) -> dict[str, Any]:
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
        repository = OrganizationRepository(session)
        rows = repository.list_crm_organizations(
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
        total_count = repository.count_crm_organizations(query=query, active=active)
        return json_response(
            200,
            {
                "items": [serialize_organization_summary(r) for r in page_rows],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _get_organization(
    event: Mapping[str, Any], *, organization_id: UUID
) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = OrganizationRepository(session)
        org = repository.get_crm_organization_by_id(organization_id)
        if org is None:
            raise NotFoundError("Organization", str(organization_id))
        return json_response(
            200,
            {"organization": serialize_organization_summary(org)},
            event=event,
        )


def _create_organization(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    body = parse_body(event)
    name = validate_string_length(
        body.get("name"),
        "name",
        max_length=255,
        required=True,
    )
    organization_type = _parse_organization_type(
        body.get("organization_type"), field="organization_type"
    )
    relationship_type = _parse_relationship_type_crm(
        body.get("relationship_type"), field="relationship_type"
    )
    website = validate_string_length(
        body.get("website"),
        "website",
        max_length=500,
        required=False,
    )
    location_id = parse_optional_uuid(body.get("location_id"), "location_id")
    tag_ids = parse_uuid_list(body.get("tag_ids"), "tag_ids")

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        ensure_location_exists(session, location_id)
        repository = OrganizationRepository(session)
        org = Organization(
            name=name or "",
            organization_type=organization_type,
            relationship_type=relationship_type,
            website=website,
            location_id=location_id,
        )
        created = repository.create(org)
        if tag_ids:
            replace_organization_tags(
                session, organization_id=created.id, tag_ids=tag_ids
            )
        session.commit()
        loaded = repository.get_crm_organization_by_id(created.id)
        if loaded is None:
            raise DatabaseError("Failed to load organization after create")
        return json_response(
            201,
            {"organization": serialize_organization_summary(loaded)},
            event=event,
        )


def _update_organization(
    event: Mapping[str, Any],
    *,
    organization_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    now = datetime.now(UTC)
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        repository = OrganizationRepository(session)
        org = repository.get_crm_organization_by_id(organization_id)
        if org is None:
            raise NotFoundError("Organization", str(organization_id))

        if "name" in body:
            org.name = (
                validate_string_length(
                    body.get("name"),
                    "name",
                    max_length=255,
                    required=True,
                )
                or org.name
            )
        if "organization_type" in body:
            org.organization_type = _parse_organization_type(
                body.get("organization_type"), field="organization_type"
            )
        if "relationship_type" in body:
            org.relationship_type = _parse_relationship_type_crm(
                body.get("relationship_type"), field="relationship_type"
            )
        if "website" in body:
            org.website = validate_string_length(
                body.get("website"),
                "website",
                max_length=500,
                required=False,
            )
        if "location_id" in body:
            loc = parse_optional_uuid(body.get("location_id"), "location_id")
            ensure_location_exists(session, loc)
            org.location_id = loc
        if "active" in body:
            active = parse_optional_bool_body(body.get("active"), field="active")
            if active is None:
                raise ValidationError("active is required", field="active")
            org.archived_at = None if active else now
        if "tag_ids" in body:
            tag_ids = parse_uuid_list(body.get("tag_ids"), "tag_ids")
            replace_organization_tags(session, organization_id=org.id, tag_ids=tag_ids)

        repository.update(org)
        session.commit()
        loaded = repository.get_crm_organization_by_id(organization_id)
        if loaded is None:
            raise DatabaseError("Failed to load organization after update")
        return json_response(
            200,
            {"organization": serialize_organization_summary(loaded)},
            event=event,
        )


def _add_organization_member(
    event: Mapping[str, Any],
    *,
    organization_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    contact_id = parse_uuid(str(body.get("contact_id")))
    role = _parse_organization_role(body.get("role"), field="role")

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        repository = OrganizationRepository(session)
        org = repository.get_crm_organization_by_id(organization_id)
        if org is None:
            raise NotFoundError("Organization", str(organization_id))
        contact = session.get(Contact, contact_id)
        if contact is None:
            raise ValidationError("contact_id not found", field="contact_id")

        member = OrganizationMember(
            organization_id=organization_id,
            contact_id=contact_id,
            role=role,
        )
        session.add(member)
        session.commit()
        loaded = repository.get_crm_organization_by_id(organization_id)
        if loaded is None:
            raise DatabaseError("Failed to load organization after adding member")
        return json_response(
            201,
            {"organization": serialize_organization_summary(loaded)},
            event=event,
        )


def _remove_organization_member(
    event: Mapping[str, Any],
    *,
    organization_id: UUID,
    member_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=_request_id(event))
        repository = OrganizationRepository(session)
        org = repository.get_crm_organization_by_id(organization_id)
        if org is None:
            raise NotFoundError("Organization", str(organization_id))
        member = session.get(OrganizationMember, member_id)
        if member is None or member.organization_id != organization_id:
            raise NotFoundError("OrganizationMember", str(member_id))
        session.delete(member)
        session.commit()
        loaded = repository.get_crm_organization_by_id(organization_id)
        if loaded is None:
            raise DatabaseError("Failed to load organization after removing member")
        return json_response(
            200,
            {"organization": serialize_organization_summary(loaded)},
            event=event,
        )


def _request_id(event: Mapping[str, Any]) -> str:
    request_context = event.get("requestContext")
    if isinstance(request_context, Mapping):
        request_id = request_context.get("requestId")
        if isinstance(request_id, str):
            return request_id.strip()
    return ""
