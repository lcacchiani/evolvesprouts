"""Unit tests for family membership role derivation from contact type."""

from __future__ import annotations

from app.db.models.enums import ContactType, FamilyRole
from app.db.models.family import family_membership_role_from_contact_type


def test_family_role_from_contact_type_mapping() -> None:
    assert (
        family_membership_role_from_contact_type(ContactType.PARENT)
        == FamilyRole.PARENT
    )
    assert (
        family_membership_role_from_contact_type(ContactType.CHILD)
        == FamilyRole.CHILD
    )
    assert (
        family_membership_role_from_contact_type(ContactType.HELPER)
        == FamilyRole.HELPER
    )
    assert (
        family_membership_role_from_contact_type(ContactType.PROFESSIONAL)
        == FamilyRole.OTHER
    )
    assert (
        family_membership_role_from_contact_type(ContactType.OTHER)
        == FamilyRole.OTHER
    )
