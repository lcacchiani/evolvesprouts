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


def test_mysqldump_backslash_escape_inside_strings() -> None:
    """mysqldump default: ``\'`` is a literal apostrophe (not string end)."""
    sql = r"""
INSERT INTO `country` VALUES
(384,'CIV','Côte d\'Ivoire',1,'225'),
(196,'HKG','Hong Kong',1,'852');
"""
    stmt = mysqldump.extract_insert_statement(sql, "country")
    assert stmt is not None
    rest = mysqldump.extract_values_sql_fragment(stmt)
    groups = mysqldump.iter_groups(rest)
    assert len(groups) == 2
    f0 = mysqldump.split_fields(groups[0])
    f1 = mysqldump.split_fields(groups[1])
    assert str(f0[1]) == "CIV"
    assert str(f0[2]) == "Côte d'Ivoire"
    assert str(f1[0]) == "196"
    assert str(f1[4]) == "852"


def test_note_insert_with_backslash_apostrophe_and_semicolon_in_content() -> None:
    sql = r"""
INSERT INTO `note` VALUES (1,'2020-01-01','2020-01-01','Follow up; child\'s visit');
INSERT INTO `other` VALUES (9);
"""
    stmt = mysqldump.extract_insert_statement(sql, "note")
    assert stmt is not None
    assert stmt.endswith(";")
    rest = mysqldump.extract_values_sql_fragment(stmt)
    fields = mysqldump.split_fields(mysqldump.iter_groups(rest)[0])
    assert str(fields[3]) == "Follow up; child's visit"
