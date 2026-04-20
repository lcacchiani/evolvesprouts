"""Tests for contacts legacy importer."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.db.models.enums import ContactSource
from app.db.models.enums import OrganizationRole
from app.db.models.enums import RelationshipType
from app.imports.base import DependencyNotMet
from app.imports.base import resolve_importer_context
from app.imports.entities._legacy_family_common import LegacyPersonRow
from app.imports.entities._legacy_family_common import parse_legacy_country_dial_codes
from app.imports.entities._legacy_family_common import parse_legacy_person_rows
from app.imports.entities.contacts import ContactsImporter


COUNTRY_SQL = """
INSERT INTO `country` (`id`, `dial_code`) VALUES (196, '852'), (138, '63');
"""

PERSON_SQL = """
INSERT INTO `person` (`id`, `family_id`, `kind`, `first_name`, `last_name`, `email`, `instagram_id`, `date_of_birth`, `phone`, `phone_country_code_id`, `occupation`, `company`, `referral_source`, `referral_person_id`, `is_newsletter_subscribed`, `deleted_at`) VALUES
(1, 10, 'parent', 'Ann', NULL, 'test@example.com', NULL, '1990-05-01', '98765432', 196, 'Dev', 'Acme', 'instagram', NULL, 1, NULL),
(2, 10, 'child', 'Bob', '?', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(3, 20, 'partner', 'Pat', 'P', 'pat@org.com', NULL, NULL, NULL, NULL, 'Lead', NULL, NULL, NULL, 0, NULL);
"""


def test_parse_country_dial_codes() -> None:
    m = parse_legacy_country_dial_codes(COUNTRY_SQL)
    assert m[196] == "852"
    assert m[138] == "63"


def test_parse_person_rows() -> None:
    rows = parse_legacy_person_rows(PERSON_SQL)
    assert len(rows) == 3
    p0 = rows[0]
    assert p0.email == "test@example.com"
    assert p0.referral_source == "instagram"


def test_apply_phone_format(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import contacts as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock()
    contact_id = uuid.uuid4()

    def _flush_sets_contact_id() -> None:
        obj = session.add.call_args[0][0]
        obj.id = contact_id

    session.flush.side_effect = _flush_sets_contact_id

    fam_id = uuid.uuid4()
    people = [
        LegacyPersonRow(
            legacy_id=1,
            family_id=10,
            kind="parent",
            first_name="A",
            last_name="B",
            email="a@example.com",
            instagram_id=None,
            date_of_birth=None,
            phone="98765432",
            phone_country_code_id=196,
            occupation=None,
            company=None,
            referral_source=None,
            referral_person_id=None,
            is_newsletter_subscribed=0,
            deleted_at=None,
        ),
    ]
    sql = COUNTRY_SQL
    importer = ContactsImporter()
    ctx = importer.resolve_context(session, dry_run=False)
    from dataclasses import replace

    ctx = replace(
        ctx,
        refs_by_entity={"families": {"10": fam_id}, "organizations": {}},
        source_sql_text=sql,
    )
    stats = importer.apply(session, people, ctx, dry_run=False)
    assert stats.inserted == 1
    contact = session.add.call_args_list[0][0][0]
    assert contact.phone == "+852-98765432"
    assert contact.source == ContactSource.MANUAL


def test_apply_org_partner_membership(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import contacts as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock()
    new_cid = uuid.uuid4()

    def _flush_sets_contact_id() -> None:
        obj = session.add.call_args[0][0]
        obj.id = new_cid

    session.flush.side_effect = _flush_sets_contact_id

    org_uuid = uuid.uuid4()
    people = [
        LegacyPersonRow(
            legacy_id=3,
            family_id=20,
            kind="partner",
            first_name="Pat",
            last_name="P",
            email="pat@org.com",
            instagram_id=None,
            date_of_birth=None,
            phone=None,
            phone_country_code_id=None,
            occupation="Director",
            company=None,
            referral_source="whatsapp",
            referral_person_id=None,
            is_newsletter_subscribed=0,
            deleted_at=None,
        ),
    ]
    importer = ContactsImporter()
    ctx = importer.resolve_context(session, dry_run=False)
    from dataclasses import replace

    ctx = replace(
        ctx,
        refs_by_entity={"families": {}, "organizations": {"20": org_uuid}},
        source_sql_text="",
    )
    importer.apply(session, people, ctx, dry_run=False)
    # Contact + OrganizationMember
    assert session.add.call_count == 2
    om = session.add.call_args_list[1][0][0]
    assert om.role == OrganizationRole.PARTNER
    assert om.title == "Director"
    contact = session.add.call_args_list[0][0][0]
    assert contact.relationship_type == RelationshipType.PARTNER
    assert contact.source == ContactSource.WHATSAPP


def test_skipped_no_dep_without_parent_ref(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import contacts as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock()

    people = [
        LegacyPersonRow(
            legacy_id=9,
            family_id=999,
            kind="parent",
            first_name="X",
            last_name="Y",
            email="x@example.com",
            instagram_id=None,
            date_of_birth=None,
            phone=None,
            phone_country_code_id=None,
            occupation=None,
            company=None,
            referral_source=None,
            referral_person_id=None,
            is_newsletter_subscribed=None,
            deleted_at=None,
        ),
    ]
    importer = ContactsImporter()
    ctx = importer.resolve_context(session, dry_run=False)
    from dataclasses import replace

    ctx = replace(
        ctx,
        refs_by_entity={"families": {}, "organizations": {}},
        source_sql_text="",
    )
    stats = importer.apply(session, people, ctx, dry_run=False)
    assert stats.skipped_no_dep == 1
    mod.refs.record_mapping.assert_not_called()


def test_resolve_context_raises_dependency_not_met(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports import refs as refs_mod

    session = MagicMock()
    session.execute.return_value.first.return_value = None
    monkeypatch.setattr(refs_mod, "has_mapping", lambda _s, _e: False)

    importer = ContactsImporter()
    with pytest.raises(DependencyNotMet):
        resolve_importer_context(importer, session, dry_run=False)
