"""Admin CRM contacts API."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.admin_crm_helpers import (
    assert_contact_can_join_family,
    assert_contact_can_join_organization,
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
from app.db.models import (
    Contact,
    ContactSource,
    ContactType,
    Family,
    FamilyMember,
    Organization,
    OrganizationMember,
    RelationshipType,
)
from app.db.models.enums import FamilyRole, OrganizationRole
from app.db.repositories import ContactRepository
from app.exceptions import DatabaseError, NotFoundError, ValidationError
from app.utils import json_response

_DEFAULT_LIMIT = 25

_REFERRAL_CONTACT_METADATA_KEY = "referral_contact_id"


def _contact_has_family_or_org_membership(session: Session, contact_id: UUID) -> bool:
    fam = session.execute(
        select(exists().where(FamilyMember.contact_id == contact_id))
    ).scalar_one()
    org = session.execute(
        select(exists().where(OrganizationMember.contact_id == contact_id))
    ).scalar_one()
    return bool(fam or org)


def _apply_referral_contact_metadata(
    contact: Contact,
    *,
    referral_contact_id: UUID | None,
    source_is_referral: bool,
) -> None:
    meta = dict(contact.source_metadata or {}) if contact.source_metadata else {}
    if not source_is_referral:
        meta.pop(_REFERRAL_CONTACT_METADATA_KEY, None)
    elif referral_contact_id is None:
        meta.pop(_REFERRAL_CONTACT_METADATA_KEY, None)
    else:
        meta[_REFERRAL_CONTACT_METADATA_KEY] = str(referral_contact_id)
    contact.source_metadata = meta if meta else None


def _validate_referrer_contact(
    session: Session,
    *,
    referrer_id: UUID,
    subject_contact_id: UUID | None,
) -> None:
    referrer = session.get(Contact, referrer_id)
    if referrer is None:
        raise ValidationError(
            "referral_contact_id not found", field="referral_contact_id"
        )
    if referrer.archived_at is not None:
        raise ValidationError(
            "Referrer contact must be active", field="referral_contact_id"
        )
    if subject_contact_id is not None and referrer_id == subject_contact_id:
        raise ValidationError(
            "A contact cannot refer themselves", field="referral_contact_id"
        )


def _sync_memberships_from_body(
    session: Session,
    *,
    contact_id: UUID,
    family_ids: list[UUID],
    organization_ids: list[UUID],
) -> None:
    if len(family_ids) > 1:
        raise ValidationError("At most one family_id is allowed", field="family_ids")
    if len(organization_ids) > 1:
        raise ValidationError(
            "At most one organization_id is allowed", field="organization_ids"
        )

    fam_stmt = select(FamilyMember).where(FamilyMember.contact_id == contact_id)
    existing_fam = list(session.execute(fam_stmt).scalars().all())
    org_stmt = select(OrganizationMember).where(
        OrganizationMember.contact_id == contact_id
    )
    existing_org = list(session.execute(org_stmt).scalars().all())

    want_fam = family_ids[0] if family_ids else None
    want_org = organization_ids[0] if organization_ids else None

    for m in existing_fam:
        if want_fam is None or m.family_id != want_fam:
            session.delete(m)
    for m in existing_org:
        if want_org is None or m.organization_id != want_org:
            session.delete(m)
    session.flush()

    if want_fam is not None:
        assert_contact_can_join_family(
            session, contact_id=contact_id, family_id=want_fam
        )
        family = session.get(Family, want_fam)
        if family is None or family.archived_at is not None:
            raise ValidationError("family_id not found", field="family_ids")
        has_row = session.execute(
            select(
                exists().where(
                    FamilyMember.contact_id == contact_id,
                    FamilyMember.family_id == want_fam,
                )
            )
        ).scalar_one()
        if not has_row:
            session.add(
                FamilyMember(
                    family_id=want_fam,
                    contact_id=contact_id,
                    role=FamilyRole.PARENT,
                    is_primary_contact=False,
                )
            )

    if want_org is not None:
        assert_contact_can_join_organization(
            session, contact_id=contact_id, organization_id=want_org
        )
        org = session.get(Organization, want_org)
        if org is None or org.archived_at is not None:
            raise ValidationError("organization_id not found", field="organization_ids")
        if org.relationship_type == RelationshipType.VENDOR:
            raise ValidationError(
                "Vendor organisations are managed under Finance",
                field="organization_ids",
            )
        has_org_row = session.execute(
            select(
                exists().where(
                    OrganizationMember.contact_id == contact_id,
                    OrganizationMember.organization_id == want_org,
                )
            )
        ).scalar_one()
        if not has_org_row:
            session.add(
                OrganizationMember(
                    organization_id=want_org,
                    contact_id=contact_id,
                    role=OrganizationRole.MEMBER,
                )
            )

    linked = want_fam is not None or want_org is not None
    subject = session.get(Contact, contact_id)
    if subject is not None and linked:
        subject.location_id = None


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
    family_ids = parse_uuid_list(body.get("family_ids"), "family_ids")
    organization_ids = parse_uuid_list(body.get("organization_ids"), "organization_ids")
    referral_contact_id: UUID | None = None
    referral_contact_in_body = "referral_contact_id" in body
    if referral_contact_in_body:
        referral_contact_id = parse_optional_uuid(
            body.get("referral_contact_id"), "referral_contact_id"
        )

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        has_membership = bool(family_ids or organization_ids)
        if location_id is not None and has_membership:
            raise ValidationError(
                "location_id must be empty when the contact is linked to a family or organisation",
                field="location_id",
            )
        ensure_location_exists(session, location_id)
        if source == ContactSource.REFERRAL:
            if not referral_contact_in_body or referral_contact_id is None:
                raise ValidationError(
                    "referral_contact_id is required when source is referral",
                    field="referral_contact_id",
                )
            _validate_referrer_contact(
                session,
                referrer_id=referral_contact_id,
                subject_contact_id=None,
            )

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
        if source == ContactSource.REFERRAL and referral_contact_id is not None:
            _apply_referral_contact_metadata(
                contact,
                referral_contact_id=referral_contact_id,
                source_is_referral=True,
            )
        try:
            created = repository.create(contact)
            if tag_ids:
                replace_contact_tags(session, contact_id=created.id, tag_ids=tag_ids)
            if family_ids or organization_ids:
                _sync_memberships_from_body(
                    session,
                    contact_id=created.id,
                    family_ids=family_ids,
                    organization_ids=organization_ids,
                )
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
    referral_in_body = "referral_contact_id" in body
    referral_id_value = (
        parse_optional_uuid(body.get("referral_contact_id"), "referral_contact_id")
        if referral_in_body
        else None
    )
    sync_memberships = "family_ids" in body or "organization_ids" in body
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

        effective_source = contact.source
        if effective_source == ContactSource.REFERRAL:
            if referral_in_body:
                if referral_id_value is None:
                    raise ValidationError(
                        "referral_contact_id is required when source is referral",
                        field="referral_contact_id",
                    )
                ref_uuid = referral_id_value
            else:
                raw_meta = (
                    (contact.source_metadata or {}).get(_REFERRAL_CONTACT_METADATA_KEY)
                    if contact.source_metadata
                    else None
                )
                ref_uuid = (
                    parse_optional_uuid(raw_meta, "referral_contact_id")
                    if raw_meta is not None and str(raw_meta).strip() != ""
                    else None
                )
                if ref_uuid is None:
                    raise ValidationError(
                        "referral_contact_id is required when source is referral",
                        field="referral_contact_id",
                    )
            _validate_referrer_contact(
                session,
                referrer_id=ref_uuid,
                subject_contact_id=contact.id,
            )
            _apply_referral_contact_metadata(
                contact,
                referral_contact_id=ref_uuid,
                source_is_referral=True,
            )
        else:
            if referral_in_body and referral_id_value is not None:
                raise ValidationError(
                    "referral_contact_id is only allowed when source is referral",
                    field="referral_contact_id",
                )
            _apply_referral_contact_metadata(
                contact,
                referral_contact_id=None,
                source_is_referral=False,
            )

        if "date_of_birth" in body:
            contact.date_of_birth = _parse_optional_date(
                body.get("date_of_birth"), field="date_of_birth"
            )

        if sync_memberships:
            family_ids = (
                parse_uuid_list(body.get("family_ids"), "family_ids")
                if "family_ids" in body
                else [m.family_id for m in contact.family_members]
            )
            organization_ids = (
                parse_uuid_list(body.get("organization_ids"), "organization_ids")
                if "organization_ids" in body
                else [m.organization_id for m in contact.organization_members]
            )
            _sync_memberships_from_body(
                session,
                contact_id=contact.id,
                family_ids=family_ids,
                organization_ids=organization_ids,
            )

        if "location_id" in body:
            loc = parse_optional_uuid(body.get("location_id"), "location_id")
            linked = _contact_has_family_or_org_membership(session, contact.id)
            if linked and loc is not None:
                raise ValidationError(
                    "location_id cannot be set while the contact is linked to a family or organisation",
                    field="location_id",
                )
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
