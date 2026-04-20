"""Shared mysqldump INSERT parsing primitives (MySQL/MariaDB text dumps)."""

from __future__ import annotations

import re


def iter_groups(values_sql: str) -> list[str]:
    """Split a MySQL ``VALUES (..),(..)`` fragment into ``(..)`` group strings."""
    depth = 0
    start: int | None = None
    i = 0
    groups: list[str] = []
    in_string = False
    n = len(values_sql)
    while i < n:
        c = values_sql[i]
        if in_string:
            if c == "'" and i + 1 < n and values_sql[i + 1] == "'":
                i += 2
                continue
            if c == "'":
                in_string = False
            i += 1
            continue
        if c == "'":
            in_string = True
            i += 1
            continue
        if c == "(":
            depth += 1
            if depth == 1:
                start = i
            i += 1
            continue
        if c == ")":
            if depth == 1 and start is not None:
                groups.append(values_sql[start : i + 1])
                start = None
            depth -= 1
            i += 1
            continue
        i += 1
    return groups


def split_fields(inner: str) -> list[str | None]:
    """Parse fields inside one ``(...)`` group. Handles quoted strings and NULL."""
    inner = inner.strip()
    if not (inner.startswith("(") and inner.endswith(")")):
        msg = f"Expected tuple wrapped in parentheses, got: {inner[:80]!r}"
        raise ValueError(msg)
    body = inner[1:-1]
    fields: list[str | None] = []
    i = 0
    buf: list[str] = []
    in_string = False
    while i < len(body):
        c = body[i]
        if in_string:
            if c == "'" and i + 1 < len(body) and body[i + 1] == "'":
                buf.append("'")
                i += 2
                continue
            if c == "'":
                in_string = False
                i += 1
                continue
            buf.append(c)
            i += 1
            continue
        if c == "'":
            in_string = True
            buf = []
            i += 1
            continue
        if c == ",":
            raw = "".join(buf).strip()
            fields.append(parse_atom(raw))
            buf = []
            i += 1
            continue
        if c.isspace():
            i += 1
            continue
        buf.append(c)
        i += 1
    tail = "".join(buf).strip()
    if tail or fields:
        fields.append(parse_atom(tail))
    return fields


def parse_atom(raw: str) -> str | None:
    s = raw.strip()
    if s.upper() == "NULL" or s == "":
        return None
    return s


INSERT_RE = re.compile(
    r"INSERT\s+INTO\s+"
    r"(?:"  # optional schema (backtick or bare identifier)
    r"(?:`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*"
    r")?"
    r"(?:`(?P<table_bt>[^`]+)`|(?P<table_bare>[A-Za-z_][A-Za-z0-9_]*))"
    r"\s*(?:\([^)]*\))?"
    r"\s+VALUES\s*(?P<rest>.+?);",
    re.IGNORECASE | re.DOTALL,
)


def _table_name_from_insert_match(m: re.Match[str]) -> str:
    bt = m.group("table_bt")
    if bt is not None:
        return bt
    bare = m.group("table_bare")
    if bare is not None:
        return bare
    msg = "INSERT match missing table name groups"
    raise RuntimeError(msg)


def extract_insert_statement(sql_text: str, table: str) -> str | None:
    want = table.lower()
    m = INSERT_RE.search(sql_text)
    while m:
        if _table_name_from_insert_match(m).lower() == want:
            return m.group(0)
        m = INSERT_RE.search(sql_text, m.end())
    return None
