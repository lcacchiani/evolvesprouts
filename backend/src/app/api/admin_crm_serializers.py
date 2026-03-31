"""JSON serializers for admin CRM entities."""

from __future__ import annotations

from typing import Any

from app.api.admin_crm_helpers import serialize_tag_ref
from app.db.models import (
    Contact,
    Family,
    FamilyMember,
    Organization,
    OrganizationMember,
)


def serialize_contact_summary(contact: Contact) -> dict[str, Any]:
    family_ids = {str(m.family_id) for m in contact.family_members}
    organization_ids = {str(m.organization_id) for m in contact.organization_members}
    tags = sorted(
        (serialize_tag_ref(ft.tag) for ft in contact.contact_tags if ft.tag),
        key=lambda t: t["name"].lower(),
    )
    return {
        "id": str(contact.id),
        "email": contact.email,
        "instagram_handle": contact.instagram_handle,
        "first_name": contact.first_name,
        "last_name": contact.last_name,
        "phone": contact.phone,
        "contact_type": contact.contact_type.value,
        "relationship_type": contact.relationship_type.value,
        "date_of_birth": contact.date_of_birth.isoformat()
        if contact.date_of_birth
        else None,
        "location_id": str(contact.location_id) if contact.location_id else None,
        "source": contact.source.value,
        "source_detail": contact.source_detail,
        "mailchimp_status": contact.mailchimp_status.value,
        "active": contact.archived_at is None,
        "archived_at": contact.archived_at,
        "created_at": contact.created_at,
        "updated_at": contact.updated_at,
        "tag_ids": [t["id"] for t in tags],
        "tags": tags,
        "family_ids": sorted(family_ids),
        "organization_ids": sorted(organization_ids),
    }


def serialize_family_member_row(member: FamilyMember) -> dict[str, Any]:
    c = member.contact
    label = ""
    if c:
        parts = [c.first_name or "", c.last_name or ""]
        label = " ".join(p for p in parts if p).strip() or (c.email or "")
    return {
        "id": str(member.id),
        "contact_id": str(member.contact_id),
        "contact_label": label,
        "role": member.role.value,
        "is_primary_contact": member.is_primary_contact,
    }


def serialize_family_summary(family: Family) -> dict[str, Any]:
    tags = sorted(
        (serialize_tag_ref(ft.tag) for ft in family.family_tags if ft.tag),
        key=lambda t: t["name"].lower(),
    )
    members = sorted(
        (serialize_family_member_row(m) for m in family.family_members),
        key=lambda m: m["contact_label"].lower(),
    )
    return {
        "id": str(family.id),
        "family_name": family.family_name,
        "relationship_type": family.relationship_type.value,
        "location_id": str(family.location_id) if family.location_id else None,
        "active": family.archived_at is None,
        "archived_at": family.archived_at,
        "created_at": family.created_at,
        "updated_at": family.updated_at,
        "tag_ids": [t["id"] for t in tags],
        "tags": tags,
        "members": members,
    }


def serialize_organization_member_row(member: OrganizationMember) -> dict[str, Any]:
    c = member.contact
    label = ""
    if c:
        parts = [c.first_name or "", c.last_name or ""]
        label = " ".join(p for p in parts if p).strip() or (c.email or "")
    return {
        "id": str(member.id),
        "contact_id": str(member.contact_id),
        "contact_label": label,
        "role": member.role.value,
    }


def serialize_organization_summary(org: Organization) -> dict[str, Any]:
    tags = sorted(
        (serialize_tag_ref(ot.tag) for ot in org.organization_tags if ot.tag),
        key=lambda t: t["name"].lower(),
    )
    members = sorted(
        (serialize_organization_member_row(m) for m in org.organization_members),
        key=lambda m: m["contact_label"].lower(),
    )
    return {
        "id": str(org.id),
        "name": org.name,
        "organization_type": org.organization_type.value,
        "relationship_type": org.relationship_type.value,
        "website": org.website,
        "location_id": str(org.location_id) if org.location_id else None,
        "active": org.archived_at is None,
        "archived_at": org.archived_at,
        "created_at": org.created_at,
        "updated_at": org.updated_at,
        "tag_ids": [t["id"] for t in tags],
        "tags": tags,
        "members": members,
    }
