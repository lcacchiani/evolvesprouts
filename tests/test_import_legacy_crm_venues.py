"""Tests for legacy MariaDB dump parsing in ``import_legacy_crm_venues``."""

from __future__ import annotations

import sys
from pathlib import Path


_SCRIPTS_IMPORTS = Path(__file__).resolve().parents[1] / "scripts" / "imports"
if str(_SCRIPTS_IMPORTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_IMPORTS))

import import_legacy_crm_venues as legacy_venues  # noqa: E402


def test_parse_legacy_districts_accepts_column_list_form() -> None:
    sql = """
    SET NAMES utf8;
    INSERT INTO `district` (`id`, `name`, `x`) VALUES
    (1, 'Central', NULL),
    (2, 'Wan Chai', 'y');
    """
    districts = legacy_venues._parse_legacy_districts(sql)
    assert districts[1] == "Central"
    assert districts[2] == "Wan Chai"


def test_parse_legacy_venues_accepts_column_list_form() -> None:
    sql = """
    INSERT INTO `venue` (`id`, `name`, `address_line1`, `address_line2`, `district_id`)
    VALUES (10, 'Hall', '1 Road', NULL, 1);
    """
    venues = legacy_venues._parse_legacy_venues(sql)
    assert len(venues) == 1
    v = venues[0]
    assert v["legacy_id"] == 10
    assert v["name"] == "Hall"
    assert v["address"] == "1 Road"
    assert v["district_id"] == 1


def test_parse_legacy_still_supports_short_insert_form() -> None:
    sql = """
    INSERT INTO `district` VALUES (3,'Kowloon');
    INSERT INTO `venue` VALUES (20,'B','Addr1',NULL,3);
    """
    assert legacy_venues._parse_legacy_districts(sql)[3] == "Kowloon"
    venues = legacy_venues._parse_legacy_venues(sql)
    assert venues[0]["legacy_id"] == 20
    assert venues[0]["district_id"] == 3


def test_extract_insert_skips_other_tables() -> None:
    sql = """
    INSERT INTO `other` VALUES (1);
    INSERT INTO `district` (`id`, `name`) VALUES (5, 'North');
    """
    stmt = legacy_venues._extract_insert_statement(sql, "district")
    assert stmt is not None
    assert "`district`" in stmt
    assert "`other`" not in stmt
