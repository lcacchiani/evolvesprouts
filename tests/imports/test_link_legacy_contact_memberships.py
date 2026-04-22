"""Tests for one-off ``scripts/imports/link_legacy_contact_memberships.py``."""

from __future__ import annotations

import importlib.util
import sys
import uuid
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.db.models import FamilyMember, OrganizationMember
from app.db.models.enums import FamilyRole, OrganizationRole
from app.imports.entities._legacy_family_common import LegacyPersonRow

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "imports"
    / "link_legacy_contact_memberships.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "link_legacy_contact_memberships",
        _SCRIPT_PATH,
    )
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


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


def test_links_family_and_org_memberships(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_module()

    contact_a = uuid.uuid4()
    contact_b = uuid.uuid4()
    family_u = uuid.uuid4()
    org_u = uuid.uuid4()

    def _fake_load_mapping(_session, entity: str):
        return {
            "contacts": {"1": contact_a, "2": contact_b},
            "families": {"10": family_u},
            "organizations": {"20": org_u},
        }[entity]

    monkeypatch.setattr(module.refs, "load_mapping", _fake_load_mapping)
    monkeypatch.setattr(
        module, "_family_membership_exists", lambda *a, **k: False
    )
    monkeypatch.setattr(
        module, "_organization_membership_exists", lambda *a, **k: False
    )

    session = MagicMock()
    persons = [
        _person(legacy_id=1, family_id=10, kind="parent"),
        _person(legacy_id=2, family_id=20, kind="partner", occupation="Director"),
    ]

    stats = module.link_memberships(session, persons, dry_run=False)

    assert stats.family_memberships_inserted == 1
    assert stats.organization_memberships_inserted == 1
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
    module = _load_module()

    contact_a = uuid.uuid4()
    contact_b = uuid.uuid4()
    family_u = uuid.uuid4()

    def _fake_load_mapping(_session, entity: str):
        return {
            "contacts": {"1": contact_a, "2": contact_b, "3": uuid.uuid4()},
            "families": {"10": family_u},
            "organizations": {},
        }[entity]

    monkeypatch.setattr(module.refs, "load_mapping", _fake_load_mapping)
    monkeypatch.setattr(
        module, "_family_membership_exists", lambda *a, **k: True
    )
    monkeypatch.setattr(
        module, "_organization_membership_exists", lambda *a, **k: False
    )

    session = MagicMock()
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

    stats = module.link_memberships(session, persons, dry_run=False)

    assert stats.family_memberships_inserted == 0
    assert stats.organization_memberships_inserted == 0
    assert stats.family_memberships_existing == 1
    assert stats.skipped_deleted == 1
    assert stats.skipped_no_parent_mapping == 1
    assert stats.skipped_no_contact_mapping == 1
    assert stats.skipped_no_family_id == 1
    assert session.add.call_count == 0


def test_dry_run_does_not_write(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_module()

    contact_a = uuid.uuid4()
    family_u = uuid.uuid4()

    def _fake_load_mapping(_session, entity: str):
        return {
            "contacts": {"1": contact_a},
            "families": {"10": family_u},
            "organizations": {},
        }[entity]

    monkeypatch.setattr(module.refs, "load_mapping", _fake_load_mapping)
    monkeypatch.setattr(
        module, "_family_membership_exists", lambda *a, **k: False
    )
    monkeypatch.setattr(
        module, "_organization_membership_exists", lambda *a, **k: False
    )

    session = MagicMock()
    persons = [_person(legacy_id=1, family_id=10, kind="parent")]

    stats = module.link_memberships(session, persons, dry_run=True)

    assert stats.family_memberships_inserted == 1
    assert session.add.call_count == 0
    session.commit.assert_not_called()
