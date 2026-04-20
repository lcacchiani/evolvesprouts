"""Tests for organizations legacy importer."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.db.models.enums import OrganizationType
from app.db.models.enums import RelationshipType
from app.imports.entities._legacy_family_common import LegacyFamilyRow
from app.imports.entities.organizations import ORGANIZATION_TYPE_RULES
from app.imports.entities.organizations import infer_organization_type_from_name
from app.imports.entities.organizations import apply_organizations


def test_organization_type_rules_constant() -> None:
    assert len(ORGANIZATION_TYPE_RULES) >= 4


def test_infer_organization_type_heuristics() -> None:
    assert infer_organization_type_from_name("Little Academy") == OrganizationType.SCHOOL
    assert infer_organization_type_from_name("Sharkfold NGO") == OrganizationType.NGO
    assert infer_organization_type_from_name("Happy Baton Group") == OrganizationType.COMMUNITY_GROUP
    assert infer_organization_type_from_name("Honeycombers Limited") == OrganizationType.COMPANY
    assert infer_organization_type_from_name("Retykle") == OrganizationType.OTHER


PARTNER_SQL = """
INSERT INTO `district` (`id`, `name`) VALUES (1, 'Central');

INSERT INTO `family` (`id`, `name`, `kind`, `district_id`, `address_line1`, `address_line2`, `latitude`, `longitude`, `deleted_at`) VALUES
(100, 'Partner Org', 'company', NULL, NULL, NULL, NULL, NULL, NULL);

INSERT INTO `person` (`id`, `family_id`, `kind`, `first_name`, `last_name`, `email`, `instagram_id`, `date_of_birth`, `phone`, `phone_country_code_id`, `occupation`, `company`, `referral_source`, `referral_person_id`, `is_newsletter_subscribed`, `deleted_at`) VALUES
(1, 100, 'partner', 'A', 'B', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
"""


def test_partner_promotes_relationship_type(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import organizations as mod

    hk = uuid.uuid4()
    area = uuid.uuid4()
    monkeypatch.setattr(mod, "hk_country_id", lambda _s: hk)
    monkeypatch.setattr(
        mod,
        "district_area_map",
        lambda _s, _h: {"Central": area},
    )
    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())

    session = MagicMock()
    assigned = uuid.uuid4()

    def _flush_sets_id() -> None:
        obj = session.add.call_args[0][0]
        obj.id = assigned

    session.flush.side_effect = _flush_sets_id

    rows = [
        LegacyFamilyRow(
            legacy_id=100,
            name="Partner Org",
            kind="company",
            district_id=None,
            district_label=None,
            address_line1=None,
            address_line2=None,
            latitude=None,
            longitude=None,
            deleted_at=None,
        ),
    ]
    stats = apply_organizations(session, rows, dry_run=False, sql_text=PARTNER_SQL)
    assert stats.inserted == 1
    org = session.add.call_args[0][0]
    assert org.relationship_type == RelationshipType.PARTNER


def test_no_partner_stays_prospect(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import organizations as mod

    hk = uuid.uuid4()
    monkeypatch.setattr(mod, "hk_country_id", lambda _s: hk)
    monkeypatch.setattr(mod, "district_area_map", lambda _s, _h: {})
    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())

    sql_no_person = """
INSERT INTO `district` (`id`, `name`) VALUES (1, 'Central');
INSERT INTO `family` (`id`, `name`, `kind`, `district_id`, `address_line1`, `address_line2`, `latitude`, `longitude`, `deleted_at`) VALUES
(200, 'Solo', 'company', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `person` (`id`, `family_id`, `kind`, `first_name`, `last_name`, `email`, `instagram_id`, `date_of_birth`, `phone`, `phone_country_code_id`, `occupation`, `company`, `referral_source`, `referral_person_id`, `is_newsletter_subscribed`, `deleted_at`) VALUES
(2, 200, 'parent', 'A', 'B', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
"""
    session = MagicMock()
    assigned = uuid.uuid4()

    def _flush_sets_id() -> None:
        obj = session.add.call_args[0][0]
        obj.id = assigned

    session.flush.side_effect = _flush_sets_id
    rows = [
        LegacyFamilyRow(
            legacy_id=200,
            name="Solo",
            kind="company",
            district_id=None,
            district_label=None,
            address_line1=None,
            address_line2=None,
            latitude=None,
            longitude=None,
            deleted_at=None,
        ),
    ]
    apply_organizations(session, rows, dry_run=False, sql_text=sql_no_person)
    org = session.add.call_args[0][0]
    assert org.relationship_type == RelationshipType.PROSPECT
