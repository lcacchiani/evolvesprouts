"""Tests for venues legacy importer."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import SAWarning

from app.imports import mysqldump
from app.imports.entities.venues import LegacyVenue
from app.imports.entities.venues import apply_venues
from app.imports.entities.venues import parse_legacy_districts
from app.imports.entities.venues import parse_legacy_venues


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
    from app.imports.entities import venues as mod

    hk = uuid.uuid4()
    area = uuid.uuid4()
    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: hk)
    monkeypatch.setattr(
        mod,
        "_district_area_map",
        lambda _s, _h: {"Central": area},
    )
    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())

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
    mod.refs.record_mapping.assert_not_called()


@pytest.mark.filterwarnings("ignore", category=SAWarning)
def test_apply_venues_inserts_and_commits(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import venues as mod

    hk = uuid.uuid4()
    area = uuid.uuid4()
    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: hk)
    monkeypatch.setattr(
        mod,
        "_district_area_map",
        lambda _s, _h: {"Central": area},
    )
    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())

    session = MagicMock()
    session.execute.return_value.all.return_value = []
    assigned_id = uuid.uuid4()

    def _flush_sets_location_id() -> None:
        loc = session.add.call_args[0][0]
        loc.id = assigned_id

    session.flush.side_effect = _flush_sets_location_id

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
    session.flush.assert_called()
    session.commit.assert_called_once()
    mod.refs.record_mapping.assert_called_once()
    assert mod.refs.record_mapping.call_args[0][2] == "1"
    assert mod.refs.record_mapping.call_args[0][3] == assigned_id


def test_apply_venues_skips_duplicate_case_insensitive(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports.entities import venues as mod

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
    from app.imports.entities import venues as mod

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


def test_apply_venues_resolves_label_from_district_map(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports.entities import venues as mod

    hk = uuid.uuid4()
    area = uuid.uuid4()
    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: hk)
    monkeypatch.setattr(
        mod,
        "_district_area_map",
        lambda _s, _h: {"North": area},
    )

    session = MagicMock()
    session.execute.return_value.all.return_value = []

    venues = [
        LegacyVenue(
            legacy_id=1,
            name="A",
            address="B",
            district_id=5,
            district_label=None,
        )
    ]
    stats = apply_venues(
        session,
        venues,
        dry_run=True,
        district_map={5: "North"},
    )
    assert stats.inserted == 1


def test_apply_venues_raises_when_district_id_without_label_or_map(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports.entities import venues as mod

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
            district_id=5,
            district_label=None,
        )
    ]
    with pytest.raises(ValueError, match="no district label"):
        apply_venues(session, venues, dry_run=True)


def test_hk_country_missing_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import venues as mod

    monkeypatch.setattr(mod, "_hk_country_id", lambda _s: (_ for _ in ()).throw(RuntimeError("no HK")))

    session = MagicMock()
    session.execute.return_value.all.return_value = []
    venues = [
        LegacyVenue(1, "A", "B", 1, "Central"),
    ]
    with pytest.raises(RuntimeError, match="no HK"):
        apply_venues(session, venues, dry_run=True)


def test_parse_legacy_districts_accepts_column_list_form() -> None:
    sql = """
    SET NAMES utf8;
    INSERT INTO `district` (`id`, `name`, `x`) VALUES
    (1, 'Central', NULL),
    (2, 'Wan Chai', 'y');
    """
    districts = parse_legacy_districts(sql)
    assert districts[1] == "Central"
    assert districts[2] == "Wan Chai"


def test_parse_legacy_venues_accepts_column_list_form() -> None:
    sql = """
    INSERT INTO `district` (`id`, `name`) VALUES (1, 'Central');

    INSERT INTO `venue` (`id`, `name`, `address_line1`, `address_line2`, `district_id`)
    VALUES (10, 'Hall', '1 Road', NULL, 1);
    """
    districts = parse_legacy_districts(sql)
    venues = parse_legacy_venues(sql, districts=districts)
    assert len(venues) == 1
    v = venues[0]
    assert v.legacy_id == 10
    assert v.name == "Hall"
    assert v.address == "1 Road"
    assert v.district_id == 1


def test_parse_legacy_still_supports_short_insert_form() -> None:
    sql = """
    INSERT INTO `district` VALUES (3,'Kowloon');
    INSERT INTO `venue` VALUES (20,'B','Addr1',NULL,3);
    """
    assert parse_legacy_districts(sql)[3] == "Kowloon"
    venues = parse_legacy_venues(sql)
    assert venues[0].legacy_id == 20
    assert venues[0].district_id == 3


def test_extract_insert_skips_other_tables() -> None:
    sql = """
    INSERT INTO `other` VALUES (1);
    INSERT INTO `district` (`id`, `name`) VALUES (5, 'North');
    """
    stmt = mysqldump.extract_insert_statement(sql, "district")
    assert stmt is not None
    assert "`district`" in stmt
    assert "`other`" not in stmt


def test_parse_accepts_schema_qualified_backtick_tables() -> None:
    sql = """
    INSERT INTO `legacy_crm`.`district` (`id`, `name`) VALUES (7, 'South');
    INSERT INTO `legacy_crm`.`venue` (`id`, `name`, `address_line1`, `address_line2`, `district_id`)
    VALUES (99, 'Room', '9 St', NULL, 7);
    """
    assert parse_legacy_districts(sql)[7] == "South"
    venues = parse_legacy_venues(sql)
    assert venues[0].legacy_id == 99
    assert venues[0].district_id == 7


def test_parse_accepts_unquoted_table_names() -> None:
    sql = """
    INSERT INTO district (id, name) VALUES (8, 'East');
    INSERT INTO venue VALUES (30, 'Hall', 'Lane', NULL, 8);
    """
    assert parse_legacy_districts(sql)[8] == "East"
    assert parse_legacy_venues(sql)[0].legacy_id == 30
