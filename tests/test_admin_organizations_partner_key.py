"""Tests for partner-only organization partner_key handling."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.api import admin_organizations
from app.db.models import RelationshipType
from app.exceptions import ValidationError


def _org_stub(
    *,
    relationship_type: RelationshipType,
    partner_key: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(relationship_type=relationship_type, partner_key=partner_key)


def test_apply_partner_key_partner_sets_normalized_value() -> None:
    org = _org_stub(relationship_type=RelationshipType.PARTNER)
    admin_organizations._apply_organization_partner_key_from_body(
        org, {"partner_key": "  Acme-Partner  "}
    )
    assert org.partner_key == "acme-partner"


def test_apply_partner_key_non_partner_clears_when_empty() -> None:
    org = _org_stub(
        relationship_type=RelationshipType.PROSPECT, partner_key="should-clear"
    )
    admin_organizations._apply_organization_partner_key_from_body(org, {"partner_key": ""})
    assert org.partner_key is None


def test_apply_partner_key_non_partner_rejects_non_empty() -> None:
    org = _org_stub(relationship_type=RelationshipType.PROSPECT)
    with pytest.raises(ValidationError, match="only allowed when"):
        admin_organizations._apply_organization_partner_key_from_body(
            org, {"partner_key": "no-partners"}
        )


def test_apply_partner_key_create_uses_passed_relationship_type() -> None:
    org = _org_stub(relationship_type=RelationshipType.PROSPECT)
    admin_organizations._apply_organization_partner_key_from_body(
        org,
        {"partner_key": "partner-key"},
        relationship_type=RelationshipType.PARTNER,
    )
    assert org.partner_key == "partner-key"
