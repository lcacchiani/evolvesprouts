"""Admin CRM contacts API."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.admin_crm_helpers import (
    crm_request_id,
    ensure_location_exists,
    list_all_tags_for_picker,
    parse_active_filter,
    parse_crm_limit,
    parse_crm_relationship_type,
    parse_optional_bool_body,
    replace_contact_tags,
    serialize_tag_ref,
)
from app.api.admin_crm_serializers import serialize_contact_summary
from app.api.admin_request import (
    encode_cursor,
    parse_body,
    parse_cursor,
    parse_uuid,
    query_param,
)
from app.api.admin_services_payload_utils import parse_optional_uuid, parse_uuid_list
from app.api.admin_validators import validate_email, validate_string_length
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import Contact, ContactSource, ContactType
from app.db.repositories import ContactRepository
from app.exceptions import DatabaseError, NotFoundError, ValidationError
from app.utils import json_response

_DEFAULT_LIMIT = 25


def handle_admin_contacts_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/contacts and /v1/admin/contacts/tags."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "contacts":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 3 and parts[2] == "tags":
        if method == "GET":
            return _list_contact_tags(event)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 2:
        if method == "GET":
            return _list_contacts(event)
        if method == "POST":
            return _create_contact(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    contact_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_contact(event, contact_id=contact_id)
        if method == "PATCH":
            return _update_contact(
                event, contact_id=contact_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_contact_tags(event: Mapping[str, Any]) -> dict[str, Any]:
    with Session(get_engine()) as session:
        tags = list_all_tags_for_picker(session)
        return json_response(
            200,
            {"items": [serialize_tag_ref(t) for t in tags]},
            event=event,
        )


def _list_contacts(event: Mapping[str, Any]) -> dict[str, Any]:
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
        repository = ContactRepository(session)
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
                "items": [serialize_contact_summary(r) for r in page_rows],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _get_contact(event: Mapping[str, Any], *, contact_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = ContactRepository(session)
        contact = repository.get_by_id_for_admin(contact_id)
        if contact is None:
            raise NotFoundError("Contact", str(contact_id))
        return json_response(
            200,
            {"contact": serialize_contact_summary(contact)},
            event=event,
        )


def _parse_optional_date(value: Any, *, field: str) -> date | None:
    if value is None or str(value).strip() == "":
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be an ISO date string", field=field)
    raw = value.strip()
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValidationError(f"{field} must be YYYY-MM-DD", field=field) from exc


def _parse_contact_type(value: Any, *, field: str) -> ContactType:
    if value is None or str(value).strip() == "":
        raise ValidationError(f"{field} is required", field=field)
    try:
        return ContactType(str(value).strip().lower())
    except ValueError as exc:
        raise ValidationError(f"Invalid {field}", field=field) from exc


def _parse_contact_source(value: Any, *, field: str) -> ContactSource:
    if value is None or str(value).strip() == "":
        return ContactSource.MANUAL
    try:
        return ContactSource(str(value).strip().lower())
    except ValueError as exc:
        raise ValidationError(f"Invalid {field}", field=field) from exc


def _create_contact(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    body = parse_body(event)
    first_name = validate_string_length(
        body.get("first_name"),
        "first_name",
        max_length=100,
        required=True,
    )
    last_name = validate_string_length(
        body.get("last_name"),
        "last_name",
        max_length=100,
        required=False,
    )
    email = validate_email(body.get("email"))
    instagram_raw = validate_string_length(
        body.get("instagram_handle"),
        "instagram_handle",
        max_length=30,
        required=False,
    )
    instagram_handle = instagram_raw.lower() if instagram_raw else None
    phone = validate_string_length(
        body.get("phone"),
        "phone",
        max_length=30,
        required=False,
    )
    contact_type = _parse_contact_type(body.get("contact_type"), field="contact_type")
    relationship_type = parse_crm_relationship_type(
        body.get("relationship_type"), field="relationship_type", forbid_vendor=True
    )
    source = _parse_contact_source(body.get("source"), field="source")
    source_detail = validate_string_length(
        body.get("source_detail"),
        "source_detail",
        max_length=5000,
        required=False,
    )
    date_of_birth = _parse_optional_date(
        body.get("date_of_birth"), field="date_of_birth"
    )
    location_id = parse_optional_uuid(body.get("location_id"), "location_id")
    tag_ids = parse_uuid_list(body.get("tag_ids"), "tag_ids")

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        ensure_location_exists(session, location_id)
        repository = ContactRepository(session)
        contact = Contact(
            email=email,
            instagram_handle=instagram_handle,
            first_name=first_name or "",
            last_name=last_name,
            phone=phone,
            contact_type=contact_type,
            relationship_type=relationship_type,
            date_of_birth=date_of_birth,
            location_id=location_id,
            source=source,
            source_detail=source_detail,
        )
        try:
            created = repository.create(contact)
            if tag_ids:
                replace_contact_tags(session, contact_id=created.id, tag_ids=tag_ids)
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            raise ValidationError(
                "Email or Instagram handle is already in use",
                field="email",
            ) from exc
        session.refresh(created)
        loaded = repository.get_by_id_for_admin(created.id)
        if loaded is None:
            raise DatabaseError("Failed to load contact after create")
        return json_response(
            201,
            {"contact": serialize_contact_summary(loaded)},
            event=event,
        )


def _update_contact(
    event: Mapping[str, Any],
    *,
    contact_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    now = datetime.now(UTC)
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        repository = ContactRepository(session)
        contact = repository.get_by_id_for_admin(contact_id)
        if contact is None:
            raise NotFoundError("Contact", str(contact_id))

        if "first_name" in body:
            contact.first_name = (
                validate_string_length(
                    body.get("first_name"),
                    "first_name",
                    max_length=100,
                    required=True,
                )
                or contact.first_name
            )
        if "last_name" in body:
            contact.last_name = validate_string_length(
                body.get("last_name"),
                "last_name",
                max_length=100,
                required=False,
            )
        if "email" in body:
            contact.email = validate_email(body.get("email"))
        if "instagram_handle" in body:
            ig = validate_string_length(
                body.get("instagram_handle"),
                "instagram_handle",
                max_length=30,
                required=False,
            )
            contact.instagram_handle = ig.lower() if ig else None
        if "phone" in body:
            contact.phone = validate_string_length(
                body.get("phone"),
                "phone",
                max_length=30,
                required=False,
            )
        if "contact_type" in body:
            contact.contact_type = _parse_contact_type(
                body.get("contact_type"), field="contact_type"
            )
        if "relationship_type" in body:
            contact.relationship_type = parse_crm_relationship_type(
                body.get("relationship_type"),
                field="relationship_type",
                forbid_vendor=True,
            )
        if "source" in body:
            contact.source = _parse_contact_source(body.get("source"), field="source")
        if "source_detail" in body:
            contact.source_detail = validate_string_length(
                body.get("source_detail"),
                "source_detail",
                max_length=5000,
                required=False,
            )
        if "date_of_birth" in body:
            contact.date_of_birth = _parse_optional_date(
                body.get("date_of_birth"), field="date_of_birth"
            )
        if "location_id" in body:
            loc = parse_optional_uuid(body.get("location_id"), "location_id")
            ensure_location_exists(session, loc)
            contact.location_id = loc
        if "active" in body:
            active = parse_optional_bool_body(body.get("active"), field="active")
            if active is None:
                raise ValidationError("active is required", field="active")
            contact.archived_at = None if active else now
        if "tag_ids" in body:
            tag_ids = parse_uuid_list(body.get("tag_ids"), "tag_ids")
            replace_contact_tags(session, contact_id=contact.id, tag_ids=tag_ids)

        try:
            updated = repository.update(contact)
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            raise ValidationError(
                "Email or Instagram handle is already in use",
                field="email",
            ) from exc
        session.refresh(updated)
        loaded = repository.get_by_id_for_admin(contact_id)
        if loaded is None:
            raise DatabaseError("Failed to load contact after update")
        return json_response(
            200,
            {"contact": serialize_contact_summary(loaded)},
            event=event,
        )
