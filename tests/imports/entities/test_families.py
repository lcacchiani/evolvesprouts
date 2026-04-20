"""Tests for families legacy importer."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.imports.entities._legacy_family_common import LegacyFamilyRow
from app.imports.entities._legacy_family_common import parse_legacy_family_rows
from app.imports.entities.families import FamiliesImporter
from app.imports.entities.families import apply_families


MINIMAL_FAMILY = """
INSERT INTO `district` (`id`, `name`) VALUES (1, 'Central');

INSERT INTO `family` (`id`, `name`, `kind`, `district_id`, `address_line1`, `address_line2`, `latitude`, `longitude`, `deleted_at`) VALUES
(10, 'The Smiths', 'family', 1, '1 Road', NULL, '22.3', '114.1', NULL),
(11, 'Deleted Fam', 'family', NULL, NULL, NULL, NULL, NULL, '2020-01-01 00:00:00'),
(12, 'Acme Corp', 'company', 1, 'HQ', NULL, NULL, NULL, NULL);
"""


def test_parse_filters_family_kind_only() -> None:
    rows = parse_legacy_family_rows(MINIMAL_FAMILY)
    fam = FamiliesImporter().parse(MINIMAL_FAMILY)
    assert len(rows) == 3
    assert len(fam) == 2
    assert {r.legacy_id for r in fam} == {10, 11}


def test_parse_unicode_and_quotes() -> None:
    sql = """
INSERT INTO district (id, name) VALUES (1, 'Central');
INSERT INTO `family` (`id`, `name`, `kind`, `district_id`, `address_line1`, `address_line2`, `latitude`, `longitude`, `deleted_at`) VALUES
(20, 'Café O''Brien', 'family', 1, 'Line', NULL, NULL, NULL, NULL);
"""
    rows = FamiliesImporter().parse(sql)
    assert len(rows) == 1
    assert rows[0].name == "Café O'Brien"


def test_apply_families_dry_run(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import families as mod

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
    rows = [
        LegacyFamilyRow(
            legacy_id=1,
            name="Fam",
            kind="family",
            district_id=1,
            district_label="Central",
            address_line1="1 St",
            address_line2=None,
            latitude=None,
            longitude=None,
            deleted_at=None,
        )
    ]
    stats = apply_families(session, rows, dry_run=True)
    assert stats.inserted == 1
    session.add.assert_not_called()
    mod.refs.record_mapping.assert_not_called()


def test_apply_skips_deleted_and_excluded(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import families as mod

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
    rows = [
        LegacyFamilyRow(
            legacy_id=1,
            name="X",
            kind="family",
            district_id=None,
            district_label=None,
            address_line1=None,
            address_line2=None,
            latitude=None,
            longitude=None,
            deleted_at="2020-01-01",
        ),
    ]
    stats = apply_families(session, rows, dry_run=False)
    assert stats.skipped_deleted == 1
    assert stats.inserted == 0

    rows2 = [
        LegacyFamilyRow(
            legacy_id=5,
            name="Y",
            kind="family",
            district_id=None,
            district_label=None,
            address_line1=None,
            address_line2=None,
            latitude=None,
            longitude=None,
            deleted_at=None,
        ),
    ]
    stats2 = apply_families(
        session,
        rows2,
        dry_run=False,
        skip_legacy_keys=frozenset({"5"}),
    )
    assert stats2.skipped_excluded_key == 1
