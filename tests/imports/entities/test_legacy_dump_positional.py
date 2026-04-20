"""Regression: mysqldump without column lists (real S3 dump shape)."""

from __future__ import annotations

from app.imports.entities._legacy_family_common import parse_legacy_country_dial_codes
from app.imports.entities._legacy_family_common import parse_legacy_family_rows
from app.imports.entities._legacy_family_common import parse_legacy_notes
from app.imports.entities._legacy_family_common import parse_legacy_person_rows


CREATE_FAMILY = """
CREATE TABLE `family` (
  `id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `district_id` int DEFAULT NULL,
  `kind` varchar(32) DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `postal_code` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
"""

# 15 columns: id, parent_id, created_at, created_by, deleted_at, deleted_by,
# name, lat, lng, address_line1, address_line2, district_id, kind, company_id, postal_code
INSERT_DISTRICT = """
INSERT INTO `district` VALUES (3,'Central');
"""

INSERT_FAMILY_POS = """
INSERT INTO `family` VALUES
(47,NULL,'2025-06-02 10:02:31',1,NULL,NULL,'Bump & Co',22.35062700,114.18491610,'Line1',NULL,3,'company',NULL,NULL);
"""

CREATE_PERSON = """
CREATE TABLE `person` (
  `id` int NOT NULL,
  `family_id` int DEFAULT NULL,
  `kind` varchar(32) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `instagram_id` varchar(64) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `phone_country_code_id` int DEFAULT NULL,
  `occupation` varchar(255) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `referral_source` varchar(64) DEFAULT NULL,
  `referral_person_id` int DEFAULT NULL,
  `is_newsletter_subscribed` tinyint DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
"""

INSERT_PERSON_POS = """
INSERT INTO `person` VALUES
(100,47,'parent','Ann','Smith','hello@bump-and-co.com',NULL,NULL,'98765432',196,NULL,NULL,NULL,NULL,0,NULL);
"""

CREATE_COUNTRY = """
CREATE TABLE `country` (
  `id` int NOT NULL,
  `iso3` char(3) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `region_id` int DEFAULT NULL,
  `dial_code` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
"""

INSERT_COUNTRY_POS = """
INSERT INTO `country` VALUES (196,'HKG','Hong Kong',1,'852');
"""


def test_family_positional_without_insert_column_list() -> None:
    sql = INSERT_DISTRICT + CREATE_FAMILY + INSERT_FAMILY_POS
    rows = parse_legacy_family_rows(sql)
    assert len(rows) == 1
    r = rows[0]
    assert r.legacy_id == 47
    assert r.name == "Bump & Co"
    assert r.kind == "company"
    assert r.address_line1 == "Line1"
    assert r.latitude == "22.35062700"


def test_person_positional_maps_phone_country_id() -> None:
    sql = CREATE_PERSON + INSERT_PERSON_POS
    rows = parse_legacy_person_rows(sql)
    assert len(rows) == 1
    p = rows[0]
    assert p.legacy_id == 100
    assert p.family_id == 47
    assert p.email == "hello@bump-and-co.com"
    assert p.phone_country_code_id == 196


def test_country_dial_code_column_not_iso3() -> None:
    sql = CREATE_COUNTRY + INSERT_COUNTRY_POS
    m = parse_legacy_country_dial_codes(sql)
    assert m[196] == "852"


def test_country_dial_codes_with_mysqldump_backslash_escapes() -> None:
    """Real dumps use ``\'`` inside names; extraction must not truncate INSERT."""
    sql = r"""
CREATE TABLE `country` (
  `id` int NOT NULL,
  `iso3` char(3) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `region_id` int DEFAULT NULL,
  `dial_code` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
INSERT INTO `country` VALUES
(384,'CIV','Côte d\'Ivoire',1,'225'),
(196,'HKG','Hong Kong',1,'852');
"""
    m = parse_legacy_country_dial_codes(sql)
    assert m[196] == "852"
    assert m[384] == "225"


def test_note_content_with_semicolon_in_string() -> None:
    sql = """
CREATE TABLE `note` (
  `id` int NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `took_at` datetime NOT NULL,
  `content` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
INSERT INTO `note` VALUES (9,'2020-01-01 00:00:00','2020-01-02 00:00:00','Call back; urgent');
"""
    notes = parse_legacy_notes(sql)
    assert len(notes) == 1
    assert notes[0].content == "Call back; urgent"
