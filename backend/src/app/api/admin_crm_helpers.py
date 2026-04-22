"""Shared helpers for admin CRM contact/family/organization APIs."""

from __future__ import annotations

from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.admin_request import query_param
from app.exceptions import ValidationError
from app.db.models import (
    ContactTag,
    FamilyMember,
    FamilyTag,
    Location,
    OrganizationMember,
    OrganizationTag,
    RelationshipType,
    Tag,
)
from app.db.models.enums import ContactType
from app.utils.logging import get_logger

logger = get_logger(__name__)


def parse_crm_limit(event: Mapping[str, Any], *, default: int = 25) -> int:
    raw = query_param(event, "limit")
    if raw is None or raw == "":
        return default
    try:
        parsed = int(raw)
    except (TypeError, ValueError) as exc:
        logger.warning("Invalid CRM limit value", extra={"field": "limit"})
        raise ValidationError("limit must be an integer", field="limit") from exc
    if parsed < 1 or parsed > 100:
        raise ValidationError("limit must be between 1 and 100", field="limit")
    return parsed


def parse_active_filter(raw: str | None) -> bool | None:
    if raw is None or raw.strip() == "":
        return None
    normalized = raw.strip().lower()
    if normalized in {"true", "1"}:
        return True
    if normalized in {"false", "0"}:
        return False
    raise ValidationError("active must be true or false", field="active")


def parse_contact_type_filter(raw: str | None) -> ContactType | None:
    """Parse optional CRM contact_type query value; empty means no filter."""
    if raw is None or raw.strip() == "":
        return None
    normalized = raw.strip().lower()
    for member in ContactType:
        if member.value == normalized:
            return member
    raise ValidationError(
        "contact_type must be a valid contact type", field="contact_type"
    )


def parse_optional_bool_body(value: Any, *, field: str) -> bool | None:
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


def serialize_tag_ref(tag: Tag) -> dict[str, Any]:
    return {
        "id": str(tag.id),
        "name": tag.name,
        "color": tag.color,
    }


def assert_contact_can_join_family(
    session: Session,
    *,
    contact_id: UUID,
    family_id: UUID,
) -> None:
    """At most one family per contact (may also belong to one organisation)."""
    fam_stmt = select(FamilyMember.family_id).where(
        FamilyMember.contact_id == contact_id
    )
    existing_family_ids = session.execute(fam_stmt).scalars().all()
    for fid in existing_family_ids:
        if fid != family_id:
            raise ValidationError(
                "Contact is already in another family; remove them from that family first",
                field="contact_id",
            )


def assert_contact_can_join_organization(
    session: Session,
    *,
    contact_id: UUID,
    organization_id: UUID,
) -> None:
    """At most one organisation per contact (may also belong to one family)."""
    org_stmt = select(OrganizationMember.organization_id).where(
        OrganizationMember.contact_id == contact_id
    )
    existing_org_ids = session.execute(org_stmt).scalars().all()
    for oid in existing_org_ids:
        if oid != organization_id:
            raise ValidationError(
                "Contact is already in another organisation; remove them from that organisation first",
                field="contact_id",
            )


def ensure_location_exists(session: Session, location_id: UUID | None) -> None:
    if location_id is None:
        return
    loc = session.get(Location, location_id)
    if loc is None:
        raise ValidationError("location_id not found", field="location_id")


def replace_contact_tags(
    session: Session,
    *,
    contact_id: UUID,
    tag_ids: list[UUID],
) -> None:
    session.execute(delete(ContactTag).where(ContactTag.contact_id == contact_id))
    for tag_id in tag_ids:
        tag = session.get(Tag, tag_id)
        if tag is None:
            raise ValidationError("tag_id not found", field="tag_ids")
        session.add(ContactTag(contact_id=contact_id, tag_id=tag_id))
    session.flush()


def replace_family_tags(
    session: Session,
    *,
    family_id: UUID,
    tag_ids: list[UUID],
) -> None:
    session.execute(delete(FamilyTag).where(FamilyTag.family_id == family_id))
    for tag_id in tag_ids:
        tag = session.get(Tag, tag_id)
        if tag is None:
            raise ValidationError("tag_id not found", field="tag_ids")
        session.add(FamilyTag(family_id=family_id, tag_id=tag_id))
    session.flush()


def replace_organization_tags(
    session: Session,
    *,
    organization_id: UUID,
    tag_ids: list[UUID],
) -> None:
    session.execute(
        delete(OrganizationTag).where(
            OrganizationTag.organization_id == organization_id
        )
    )
    for tag_id in tag_ids:
        tag = session.get(Tag, tag_id)
        if tag is None:
            raise ValidationError("tag_id not found", field="tag_ids")
        session.add(OrganizationTag(organization_id=organization_id, tag_id=tag_id))
    session.flush()


def list_all_tags_for_picker(session: Session) -> list[Tag]:
    statement = select(Tag).order_by(func.lower(Tag.name))
    return list(session.execute(statement).scalars().all())


def crm_request_id(event: Mapping[str, Any]) -> str:
    """API Gateway request id for audit context (shared by CRM admin handlers)."""
    request_context = event.get("requestContext")
    if isinstance(request_context, Mapping):
        request_id = request_context.get("requestId")
        if isinstance(request_id, str):
            return request_id.strip()
    return ""


def parse_crm_relationship_type(
    value: Any,
    *,
    field: str,
    allowed: frozenset[RelationshipType] | None = None,
) -> RelationshipType:
    """Parse relationship_type for CRM payloads.

    When ``allowed`` is set, the parsed value must be a member of that set
    (after resolving the string to :class:`RelationshipType`).
    """
    if value is None or str(value).strip() == "":
        parsed = RelationshipType.PROSPECT
    else:
        try:
            parsed = RelationshipType(str(value).strip().lower())
        except ValueError as exc:
            raise ValidationError(f"Invalid {field}", field=field) from exc
    if allowed is not None and parsed not in allowed:
        raise ValidationError(
            f"{field} is not allowed for this entity",
            field=field,
        )
    return parsed


CRM_FAMILY_RELATIONSHIP_TYPES: frozenset[RelationshipType] = frozenset(
    {
        RelationshipType.PROSPECT,
        RelationshipType.CLIENT,
        RelationshipType.OTHER,
    }
)

CRM_ORGANIZATION_RELATIONSHIP_TYPES: frozenset[RelationshipType] = frozenset(
    set(RelationshipType) - {RelationshipType.PAST_CLIENT}
)
