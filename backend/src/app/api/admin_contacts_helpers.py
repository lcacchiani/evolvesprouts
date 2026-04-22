"""Shared contact helpers for admin CRM contact mutations."""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.api.admin_entities_helpers import (
    assert_contact_can_join_family,
    assert_contact_can_join_organization,
)
from app.api.admin_services_payload_utils import parse_optional_uuid
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
from app.exceptions import ValidationError
from app.utils.logging import get_logger

logger = get_logger(__name__)

REFERRAL_CONTACT_METADATA_KEY = "referral_contact_id"


def contact_has_family_or_org_membership(session: Session, contact_id: UUID) -> bool:
    fam = session.execute(
        select(exists().where(FamilyMember.contact_id == contact_id))
    ).scalar_one()
    org = session.execute(
        select(exists().where(OrganizationMember.contact_id == contact_id))
    ).scalar_one()
    return bool(fam or org)


def apply_referral_contact_metadata(
    contact: Contact,
    *,
    referral_contact_id: UUID | None,
    source_is_referral: bool,
) -> None:
    meta = dict(contact.source_metadata or {}) if contact.source_metadata else {}
    if not source_is_referral or referral_contact_id is None:
        meta.pop(REFERRAL_CONTACT_METADATA_KEY, None)
    else:
        meta[REFERRAL_CONTACT_METADATA_KEY] = str(referral_contact_id)
    contact.source_metadata = meta if meta else None


def validate_referrer_contact(
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


def sync_memberships_from_body(
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

    for fam_member in existing_fam:
        if want_fam is None or fam_member.family_id != want_fam:
            session.delete(fam_member)
    for org_member in existing_org:
        if want_org is None or org_member.organization_id != want_org:
            session.delete(org_member)
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


def parse_optional_date(value: Any, *, field: str) -> date | None:
    if value is None or str(value).strip() == "":
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be an ISO date string", field=field)
    raw = value.strip()
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        logger.warning(
            "Invalid date payload for contact field",
            extra={"field": field},
        )
        raise ValidationError(f"{field} must be YYYY-MM-DD", field=field) from exc


def parse_contact_type(value: Any, *, field: str) -> ContactType:
    if value is None or str(value).strip() == "":
        raise ValidationError(f"{field} is required", field=field)
    try:
        return ContactType(str(value).strip().lower())
    except ValueError as exc:
        raise ValidationError(f"Invalid {field}", field=field) from exc


def parse_contact_source(value: Any, *, field: str) -> ContactSource:
    if value is None or str(value).strip() == "":
        return ContactSource.MANUAL
    try:
        return ContactSource(str(value).strip().lower())
    except ValueError as exc:
        raise ValidationError(f"Invalid {field}", field=field) from exc


def parse_referral_contact_id_from_metadata(contact: Contact) -> UUID | None:
    raw_meta = (
        (contact.source_metadata or {}).get(REFERRAL_CONTACT_METADATA_KEY)
        if contact.source_metadata
        else None
    )
    return (
        parse_optional_uuid(raw_meta, "referral_contact_id")
        if raw_meta is not None and str(raw_meta).strip() != ""
        else None
    )
