"""Tests for legacy MariaDB dump parsing in ``app.imports.legacy_crm_venues``."""

from __future__ import annotations

from app.imports.legacy_crm_venues import parse_legacy_districts
from app.imports.legacy_crm_venues import parse_legacy_venues


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
    from app.imports import legacy_crm_venues as legacy_venues

    sql = """
    INSERT INTO `other` VALUES (1);
    INSERT INTO `district` (`id`, `name`) VALUES (5, 'North');
    """
    stmt = legacy_venues._extract_insert_statement(sql, "district")
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
