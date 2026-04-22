"""Unit tests for organisation membership role derivation from contact type."""

from __future__ import annotations

from app.db.models.enums import ContactType, OrganizationRole
from app.db.models.organization import organization_membership_role_from_contact_type


def test_organization_role_from_contact_type_mapping() -> None:
    assert (
        organization_membership_role_from_contact_type(ContactType.PARENT)
        == OrganizationRole.STAFF
    )
    assert (
        organization_membership_role_from_contact_type(ContactType.HELPER)
        == OrganizationRole.STAFF
    )
    assert (
        organization_membership_role_from_contact_type(ContactType.PROFESSIONAL)
        == OrganizationRole.STAFF
    )
    assert (
        organization_membership_role_from_contact_type(ContactType.CHILD)
        == OrganizationRole.MEMBER
    )
    assert (
        organization_membership_role_from_contact_type(ContactType.OTHER)
        == OrganizationRole.OTHER
    )
