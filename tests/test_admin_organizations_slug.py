"""Tests for partner-only organization slug handling."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.api import admin_organizations_crm
from app.db.models import RelationshipType
from app.exceptions import ValidationError


def _org_stub(
    *,
    relationship_type: RelationshipType,
    slug: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(relationship_type=relationship_type, slug=slug)


def test_apply_slug_partner_sets_normalized_value() -> None:
    org = _org_stub(relationship_type=RelationshipType.PARTNER)
    admin_organizations_crm._apply_organization_slug_from_body(
        org, {"slug": "  Acme-Partner  "}
    )
    assert org.slug == "acme-partner"


def test_apply_slug_non_partner_clears_when_empty() -> None:
    org = _org_stub(relationship_type=RelationshipType.PROSPECT, slug="should-clear")
    admin_organizations_crm._apply_organization_slug_from_body(org, {"slug": ""})
    assert org.slug is None


def test_apply_slug_non_partner_rejects_non_empty() -> None:
    org = _org_stub(relationship_type=RelationshipType.PROSPECT)
    with pytest.raises(ValidationError, match="only allowed when"):
        admin_organizations_crm._apply_organization_slug_from_body(
            org, {"slug": "no-partners"}
        )


def test_apply_slug_create_uses_passed_relationship_type() -> None:
    org = _org_stub(relationship_type=RelationshipType.PROSPECT)
    admin_organizations_crm._apply_organization_slug_from_body(
        org,
        {"slug": "partner-slug"},
        relationship_type=RelationshipType.PARTNER,
    )
    assert org.slug == "partner-slug"
