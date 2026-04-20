"""Tests for legacy CRM venue SQL parsing and apply_venues."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import SAWarning

from app.imports.legacy_crm_venues import LegacyVenue
from app.imports.legacy_crm_venues import apply_venues
from app.imports.legacy_crm_venues import parse_legacy_districts
from app.imports.legacy_crm_venues import parse_legacy_venues


MINIMAL_DUMP = """
INSERT INTO `crm`.`district` (`id`, `name`) VALUES
(1, 'Central'),
(2, 'Wan Chai');

INSERT INTO `venue` (`id`, `name`, `address_line1`, `address_line2`, `district_id`) VALUES
(10, 'Hall A', '1 Road', NULL, 1),
(11, 'Hall B', '2 Other', 'Floor 3', 2);
"""

SCHEMA_DISTRICT_ONLY = """
INSERT INTO `some_db`.`district` (`id`, `name`) VALUES (5, 'Eastern');
"""

SCHEMA_VENUE_MULTIRow = """
INSERT INTO `some_db`.`district` (`id`, `name`) VALUES (5, 'Eastern');

INSERT INTO some_db.venue (id, name, address_line1, address_line2, district_id) VALUES
(20, 'O''Reilly''s', 'Line', NULL, 5),
(21, NULL, NULL, NULL, NULL);
"""

EMBEDDED_QUOTES = """
INSERT INTO district (id, name) VALUES (1, 'A');

INSERT INTO `venue` (`id`, `name`, `address_line1`, `address_line2`, `district_id`) VALUES
(30, 'Café', 'It''s here', NULL, 1);
"""


def test_parse_districts_schema_qualified() -> None:
    d = parse_legacy_districts(SCHEMA_DISTRICT_ONLY)
    assert d[5] == "Eastern"


def test_parse_venues_multivalue_and_null_district() -> None:
    d = parse_legacy_districts(SCHEMA_VENUE_MULTIRow)
    venues = parse_legacy_venues(SCHEMA_VENUE_MULTIRow, districts=d)
    assert len(venues) == 2
    assert venues[0].name == "O'Reilly's"
    assert venues[0].district_label == "Eastern"
    assert venues[1].district_id is None
    assert venues[1].district_label is None


def test_parse_venues_auto_districts() -> None:
    sql = MINIMAL_DUMP
    venues = parse_legacy_venues(sql)
    assert {v.legacy_id for v in venues} == {10, 11}
    central = next(v for v in venues if v.legacy_id == 10)
    assert central.district_label == "Central"
    assert central.address == "1 Road"


def test_parse_embedded_quotes() -> None:
    d = parse_legacy_districts(EMBEDDED_QUOTES)
    v = parse_legacy_venues(EMBEDDED_QUOTES, districts=d)
    assert len(v) == 1
    assert v[0].address == "It's here"


def test_apply_venues_dry_run_no_commit(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports import legacy_crm_venues as mod

    hk = uuid.uuid4()
    area = uuid.uuid4()
    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: hk)
    monkeypatch.setattr(
        mod,
        "_district_area_map",
        lambda _s, _h: {"Central": area},
    )

    session = MagicMock()
    session.execute.return_value.all.return_value = []

    venues = [
        LegacyVenue(
            legacy_id=1,
            name="  Foo Bar  ",
            address="1 St",
            district_id=1,
            district_label="Central",
        )
    ]
    stats = apply_venues(session, venues, dry_run=True)
    assert stats.inserted == 1
    assert stats.skipped_duplicate == 0
    session.add.assert_not_called()
    session.commit.assert_not_called()


@pytest.mark.filterwarnings("ignore", category=SAWarning)
def test_apply_venues_inserts_and_commits(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports import legacy_crm_venues as mod

    hk = uuid.uuid4()
    area = uuid.uuid4()
    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: hk)
    monkeypatch.setattr(
        mod,
        "_district_area_map",
        lambda _s, _h: {"Central": area},
    )

    session = MagicMock()
    session.execute.return_value.all.return_value = []

    venues = [
        LegacyVenue(
            legacy_id=1,
            name="Foo",
            address="1 St",
            district_id=1,
            district_label="Central",
        )
    ]
    stats = apply_venues(session, venues, dry_run=False)
    assert stats.inserted == 1
    session.add.assert_called_once()
    session.commit.assert_called_once()


def test_apply_venues_skips_duplicate_case_insensitive(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports import legacy_crm_venues as mod

    hk = uuid.uuid4()
    area = uuid.uuid4()
    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: hk)
    monkeypatch.setattr(
        mod,
        "_district_area_map",
        lambda _s, _h: {"Central": area},
    )

    session = MagicMock()
    session.execute.return_value.all.return_value = [("FOO", "1 ST")]

    venues = [
        LegacyVenue(
            legacy_id=1,
            name="foo",
            address="  1 st  ",
            district_id=1,
            district_label="Central",
        )
    ]
    stats = apply_venues(session, venues, dry_run=False)
    assert stats.inserted == 0
    assert stats.skipped_duplicate == 1
    session.add.assert_not_called()


def test_apply_venues_skips_no_area(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports import legacy_crm_venues as mod

    hk = uuid.uuid4()
    area = uuid.uuid4()
    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: hk)
    monkeypatch.setattr(
        mod,
        "_district_area_map",
        lambda _s, _h: {"Central": area},
    )

    session = MagicMock()
    session.execute.return_value.all.return_value = []

    venues = [
        LegacyVenue(
            legacy_id=1,
            name="X",
            address="Y",
            district_id=1,
            district_label="Unknown District",
        )
    ]
    stats = apply_venues(session, venues, dry_run=False)
    assert stats.skipped_no_area == 1
    assert stats.inserted == 0


def test_hk_country_missing_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports import legacy_crm_venues as mod

    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: (_ for _ in ()).throw(RuntimeError("no HK")))

    session = MagicMock()
    session.execute.return_value.all.return_value = []
    venues = [
        LegacyVenue(1, "A", "B", 1, "Central"),
    ]
    with pytest.raises(RuntimeError, match="no HK"):
        apply_venues(session, venues, dry_run=True)
