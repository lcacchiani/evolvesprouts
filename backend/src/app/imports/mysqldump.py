"""Shared mysqldump INSERT parsing primitives (MySQL/MariaDB text dumps)."""

from __future__ import annotations

import re


def _string_scan_advance(
    s: str, i: int, *, n: int, in_string: bool
) -> tuple[int, bool]:
    """Advance one step while scanning for structural tokens (parens, semicolons).

    Handles mysqldump-style ``\'`` and ``\\`` inside single-quoted strings, plus
    SQL ``''`` doubled quotes. Returns ``(new_index, in_string)``.
    """
    if not in_string:
        return i + 1, in_string
    c = s[i]
    # Backslash escapes the next character (mysqldump default NO_BACKSLASH_ESCAPES off).
    if c == "\\" and i + 1 < n:
        return i + 2, True
    if c == "'" and i + 1 < n and s[i + 1] == "'":
        return i + 2, True
    if c == "'":
        return i + 1, False
    return i + 1, True


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
            i, in_string = _string_scan_advance(values_sql, i, n=n, in_string=True)
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
    blen = len(body)
    while i < blen:
        c = body[i]
        if in_string:
            if c == "\\" and i + 1 < blen:
                buf.append(body[i + 1])
                i += 2
                continue
            if c == "'" and i + 1 < blen and body[i + 1] == "'":
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


def first_semicolon_outside_strings(s: str, start: int = 0) -> int:
    """Index of first ``;`` not inside a single-quoted SQL string, or -1."""
    i = start
    n = len(s)
    in_string = False
    while i < n:
        c = s[i]
        if in_string:
            i, in_string = _string_scan_advance(s, i, n=n, in_string=True)
            continue
        if c == "'":
            in_string = True
            i += 1
            continue
        if c == ";":
            return i
        i += 1
    return -1


INSERT_HEAD_RE = re.compile(
    r"INSERT\s+INTO\s+",
    re.IGNORECASE,
)


def _table_from_insert_after_match(sql_text: str, insert_at: int) -> str | None:
    """Parse table name after ``INSERT INTO`` (optional schema.). Returns lower name."""
    i = insert_at
    n = len(sql_text)
    while i < n and sql_text[i].isspace():
        i += 1
    if i >= n:
        return None
    # Optional `schema`.`table` or schema.table
    name_parts: list[str] = []
    while True:
        if i < n and sql_text[i] == "`":
            j = sql_text.find("`", i + 1)
            if j == -1:
                return None
            name_parts.append(sql_text[i + 1 : j])
            i = j + 1
        else:
            start = i
            while i < n and (sql_text[i].isalnum() or sql_text[i] == "_"):
                i += 1
            if i == start:
                return None
            name_parts.append(sql_text[start:i])
        while i < n and sql_text[i].isspace():
            i += 1
        if i < n and sql_text[i] == ".":
            i += 1
            while i < n and sql_text[i].isspace():
                i += 1
            continue
        break
    if not name_parts:
        return None
    return name_parts[-1].lower()


def extract_insert_statement(sql_text: str, table: str) -> str | None:
    """Find full ``INSERT INTO `table` ... ;`` including semicolons inside quoted TEXT."""
    want = table.lower()
    for m in INSERT_HEAD_RE.finditer(sql_text):
        tname = _table_from_insert_after_match(sql_text, m.end())
        if tname != want:
            continue
        semi = first_semicolon_outside_strings(sql_text, m.start())
        if semi == -1:
            return None
        return sql_text[m.start() : semi + 1]
    return None


INSERT_RE = re.compile(
    r"INSERT\s+INTO\s+"
    r"(?:"  # optional schema (backtick or bare identifier)
    r"(?:`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*"
    r")?"
    r"(?:`(?P<table_bt>[^`]+)`|(?P<table_bare>[A-Za-z_][A-Za-z0-9_]*))"
    r"\s*(?:\((?P<cols>[^)]+)\))?"
    r"\s+VALUES\s*(?P<rest>.+);",
    re.IGNORECASE | re.DOTALL,
)


def parse_insert_column_names(stmt: str) -> list[str] | None:
    """Return normalized column names if the INSERT lists them, else None.

    Uses the ``VALUES`` keyword as anchor so semicolons inside quoted TEXT in
    later rows do not truncate the match.
    """
    vm = re.search(r"\bVALUES\b", stmt, re.IGNORECASE)
    if vm is None:
        return None
    head = stmt[: vm.start()].rstrip()
    cm = re.search(r"\((?P<cols>[^)]+)\)\s*$", head, re.DOTALL)
    if cm is None:
        return None
    raw = cm.group("cols")
    names: list[str] = []
    for part in raw.split(","):
        p = part.strip()
        if p.startswith("`") and p.endswith("`") and len(p) >= 2:
            names.append(p[1:-1])
        else:
            names.append(p)
    return names


def row_dict_from_fields(
    column_names: list[str] | None,
    fields: list[str | None],
    *,
    positional_fallback: dict[int, str],
) -> dict[str, str | None]:
    """Map split field values to names; use ``positional_fallback`` when unnamed."""
    out: dict[str, str | None] = {}
    if column_names is not None and len(column_names) == len(fields):
        for name, val in zip(column_names, fields, strict=True):
            out[name] = val
        return out
    for idx, val in enumerate(fields):
        key = positional_fallback.get(idx)
        if key is not None:
            out[key] = val
    return out


def _table_name_from_insert_match(m: re.Match[str]) -> str:
    bt = m.group("table_bt")
    if bt is not None:
        return bt
    bare = m.group("table_bare")
    if bare is not None:
        return bare
    msg = "INSERT match missing table name groups"
    raise RuntimeError(msg)


CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+(?:`[^`]+`\.)?`(?P<t>[^`]+)`\s*\(",
    re.IGNORECASE,
)


def parse_create_table_column_names(sql_text: str, table: str) -> list[str] | None:
    """Column names from ``CREATE TABLE `table``` block (mysqldump-style)."""
    want = table.lower()
    for m in CREATE_TABLE_RE.finditer(sql_text):
        if m.group("t").lower() != want:
            continue
        body_start = m.end() - 1  # position of '('
        depth = 0
        in_string = False
        i = body_start
        n = len(sql_text)
        body_end = -1
        while i < n:
            c = sql_text[i]
            if in_string:
                i, in_string = _string_scan_advance(sql_text, i, n=n, in_string=True)
                continue
            if c == "'":
                in_string = True
                i += 1
                continue
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    body_end = i
                    break
            i += 1
        if body_end == -1:
            return None
        body = sql_text[body_start + 1 : body_end]
        return _column_names_from_create_body(body)
    return None


_SKIP_FIRST_BACKTICK = frozenset(
    {
        "primary",
        "unique",
        "key",
        "constraint",
        "foreign",
        "fulltext",
        "spatial",
        "check",
        "index",
    },
)


def _column_names_from_create_body(body: str) -> list[str]:
    names: list[str] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("--"):
            continue
        lead = line.lstrip("(").strip()
        ul = lead.upper()
        if ul.startswith("CONSTRAINT ") or ul.startswith("FOREIGN KEY"):
            continue
        if (
            ul.startswith("KEY ")
            or ul.startswith("UNIQUE KEY ")
            or ul.startswith("PRIMARY KEY")
        ):
            continue
        if ul.startswith("FULLTEXT KEY ") or ul.startswith("SPATIAL KEY "):
            continue
        if not line.startswith("`"):
            continue
        end = line.find("`", 1)
        if end == -1:
            continue
        col = line[1:end]
        if col.lower() in _SKIP_FIRST_BACKTICK:
            continue
        names.append(col)
    return names


def extract_values_sql_fragment(stmt: str) -> str:
    """Return the ``...`` after ``VALUES`` for this INSERT (caller ensures one statement)."""
    m = re.search(r"\bVALUES\b", stmt, re.IGNORECASE)
    if m is None:
        msg = "INSERT statement missing VALUES"
        raise ValueError(msg)
    rest = stmt[m.end() :].rstrip()
    if rest.endswith(";"):
        rest = rest[:-1].rstrip()
    return rest
