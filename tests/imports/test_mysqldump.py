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


def test_extract_insert_includes_semicolon_inside_quoted_text() -> None:
    sql = """
    INSERT INTO `note` VALUES (1,'2020-01-01','2020-01-01','hello; world');
    """
    stmt = mysqldump.extract_insert_statement(sql, "note")
    assert stmt is not None
    assert "hello; world" in stmt
    rest = mysqldump.extract_values_sql_fragment(stmt)
    groups = mysqldump.iter_groups(rest)
    fields = mysqldump.split_fields(groups[0])
    assert str(fields[3]) == "hello; world"


def test_parse_insert_column_names_not_truncated_by_semicolon_in_next_row() -> None:
    stmt = """
INSERT INTO `note` (`id`,`created_at`,`took_at`,`content`) VALUES
(1,'2020-01-01','2020-01-01','a;b'),
(2,'2020-01-01','2020-01-01','c');
""".strip()
    cols = mysqldump.parse_insert_column_names(stmt)
    assert cols == ["id", "created_at", "took_at", "content"]
