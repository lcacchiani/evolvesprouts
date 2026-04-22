"""Tests for ``link_contact_memberships`` one-off backfill importer."""

from __future__ import annotations

import uuid
from dataclasses import replace
from unittest.mock import MagicMock

import pytest

from app.db.models import FamilyMember, OrganizationMember
from app.db.models.enums import FamilyRole, OrganizationRole
from app.imports.base import ImporterContext
from app.imports.entities._legacy_family_common import LegacyPersonRow
from app.imports.entities.link_contact_memberships import (
    LinkContactMembershipsImporter,
)


def _person(
    *,
    legacy_id: int,
    family_id: int | None,
    kind: str | None,
    deleted_at: str | None = None,
    occupation: str | None = None,
) -> LegacyPersonRow:
    return LegacyPersonRow(
        legacy_id=legacy_id,
        family_id=family_id,
        kind=kind,
        first_name="F",
        last_name="L",
        email=None,
        instagram_id=None,
        date_of_birth=None,
        phone=None,
        phone_country_code_id=None,
        occupation=occupation,
        company=None,
        referral_source=None,
        referral_person_id=None,
        is_newsletter_subscribed=None,
        deleted_at=deleted_at,
    )


def _ctx(
    *,
    contacts: dict[str, uuid.UUID],
    families: dict[str, uuid.UUID],
    organizations: dict[str, uuid.UUID],
) -> ImporterContext:
    return ImporterContext(
        refs_by_entity={
            "contacts": contacts,
            "families": families,
            "organizations": organizations,
        },
    )


def test_inserts_family_and_org_memberships(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import link_contact_memberships as mod

    monkeypatch.setattr(mod, "_family_membership_exists", lambda *a, **k: False)
    monkeypatch.setattr(mod, "_organization_membership_exists", lambda *a, **k: False)

    session = MagicMock()
    contact_a = uuid.uuid4()
    contact_b = uuid.uuid4()
    family_u = uuid.uuid4()
    org_u = uuid.uuid4()

    persons = [
        _person(legacy_id=1, family_id=10, kind="parent"),
        _person(legacy_id=2, family_id=20, kind="partner", occupation="Director"),
    ]
    ctx = _ctx(
        contacts={"1": contact_a, "2": contact_b},
        families={"10": family_u},
        organizations={"20": org_u},
    )

    importer = LinkContactMembershipsImporter()
    stats = importer.apply(session, persons, ctx, dry_run=False)

    assert stats.inserted == 2
    assert stats.diagnostics["family_memberships_inserted"] == 1
    assert stats.diagnostics["organization_memberships_inserted"] == 1
    assert session.add.call_count == 2

    fm = session.add.call_args_list[0][0][0]
    assert isinstance(fm, FamilyMember)
    assert fm.family_id == family_u
    assert fm.contact_id == contact_a
    assert fm.role == FamilyRole.PARENT

    om = session.add.call_args_list[1][0][0]
    assert isinstance(om, OrganizationMember)
    assert om.organization_id == org_u
    assert om.contact_id == contact_b
    assert om.role == OrganizationRole.PARTNER
    assert om.title == "Director"

    session.commit.assert_called_once()


def test_skips_deleted_missing_mappings_and_existing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports.entities import link_contact_memberships as mod

    monkeypatch.setattr(mod, "_family_membership_exists", lambda *a, **k: True)
    monkeypatch.setattr(mod, "_organization_membership_exists", lambda *a, **k: False)

    session = MagicMock()
    contact_a = uuid.uuid4()
    contact_b = uuid.uuid4()
    family_u = uuid.uuid4()

    persons = [
        _person(legacy_id=1, family_id=10, kind="parent"),
        _person(
            legacy_id=2,
            family_id=10,
            kind="child",
            deleted_at="2024-01-01 00:00:00",
        ),
        _person(legacy_id=3, family_id=999, kind="parent"),
        _person(legacy_id=99, family_id=10, kind="parent"),
        _person(legacy_id=4, family_id=None, kind="parent"),
    ]
    ctx = _ctx(
        contacts={"1": contact_a, "2": contact_b, "3": uuid.uuid4()},
        families={"10": family_u},
        organizations={},
    )

    importer = LinkContactMembershipsImporter()
    stats = importer.apply(session, persons, ctx, dry_run=False)

    assert stats.inserted == 0
    assert stats.diagnostics["family_memberships_existing"] == 1
    assert stats.skipped_deleted == 1
    assert stats.diagnostics["skipped_no_parent_mapping"] == 1
    assert stats.diagnostics["skipped_no_contact_mapping"] == 1
    assert stats.diagnostics["skipped_no_family_id"] == 1
    assert session.add.call_count == 0


def test_dry_run_does_not_write(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import link_contact_memberships as mod

    monkeypatch.setattr(mod, "_family_membership_exists", lambda *a, **k: False)
    monkeypatch.setattr(mod, "_organization_membership_exists", lambda *a, **k: False)

    session = MagicMock()
    contact_a = uuid.uuid4()
    family_u = uuid.uuid4()
    ctx = _ctx(
        contacts={"1": contact_a},
        families={"10": family_u},
        organizations={},
    )
    persons = [_person(legacy_id=1, family_id=10, kind="parent")]

    importer = LinkContactMembershipsImporter()
    stats = importer.apply(session, persons, ctx, dry_run=True)

    assert stats.inserted == 1
    assert stats.diagnostics["family_memberships_inserted"] == 1
    assert session.add.call_count == 0
    session.commit.assert_not_called()
    assert stats.preview, "dry run should populate preview lines"
    assert stats.row_details, "dry run should populate row_details"


def test_skip_legacy_keys_excludes_persons(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import link_contact_memberships as mod

    monkeypatch.setattr(mod, "_family_membership_exists", lambda *a, **k: False)
    monkeypatch.setattr(mod, "_organization_membership_exists", lambda *a, **k: False)

    session = MagicMock()
    contact_a = uuid.uuid4()
    family_u = uuid.uuid4()
    base_ctx = _ctx(
        contacts={"1": contact_a},
        families={"10": family_u},
        organizations={},
    )
    ctx = replace(base_ctx, skip_legacy_keys=frozenset({"1"}))
    persons = [_person(legacy_id=1, family_id=10, kind="parent")]

    importer = LinkContactMembershipsImporter()
    stats = importer.apply(session, persons, ctx, dry_run=False)

    assert stats.inserted == 0
    assert stats.skipped_excluded_key == 1
    assert session.add.call_count == 0


def test_parse_delegates_to_legacy_person_parser() -> None:
    sql = (
        "INSERT INTO `person` (`id`, `family_id`, `kind`, `first_name`, "
        "`last_name`, `email`, `instagram_id`, `date_of_birth`, `phone`, "
        "`phone_country_code_id`, `occupation`, `company`, `referral_source`, "
        "`referral_person_id`, `is_newsletter_subscribed`, `deleted_at`) VALUES "
        "(1, 10, 'parent', 'A', 'B', NULL, NULL, NULL, NULL, NULL, NULL, NULL, "
        "NULL, NULL, NULL, NULL);"
    )
    importer = LinkContactMembershipsImporter()
    rows = list(importer.parse(sql))
    assert len(rows) == 1
    assert rows[0].legacy_id == 1
    assert rows[0].family_id == 10
