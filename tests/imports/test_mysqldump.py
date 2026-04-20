"""Tests for mysqldump INSERT parsing primitives."""

from __future__ import annotations

from app.imports import mysqldump


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
    """
    stmt = mysqldump.extract_insert_statement(sql, "district")
    assert stmt is not None
    m = mysqldump.INSERT_RE.match(stmt)
    assert m is not None
    rest = m.group("rest").rstrip().rstrip(";").rstrip()
    groups = mysqldump.iter_groups(rest)
    fields = mysqldump.split_fields(groups[0])
    assert int(str(fields[0])) == 7
    assert str(fields[1]) == "South"


def test_parse_accepts_unquoted_table_names() -> None:
    sql = """
    INSERT INTO district (id, name) VALUES (8, 'East');
    """
    stmt = mysqldump.extract_insert_statement(sql, "district")
    assert stmt is not None
