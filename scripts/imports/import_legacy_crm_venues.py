#!/usr/bin/env python3
"""Import venues from a legacy MariaDB/MySQL dump into PostgreSQL ``locations``.

Reads a **local path** to a ``.sql`` dump (for example downloaded from S3 to
``/tmp``). The dump is **not** committed to git; keep it outside the repo or
under ``scripts/imports/`` (gitignored).

Expected legacy tables (Evolve Sprouts CRM):

- ``district`` — ``id``, ``name`` (Hong Kong district label), …
- ``venue`` — ``name``, ``address_line1``, ``address_line2``, ``district_id``

Each imported row becomes a ``locations`` row with ``area_id`` resolved by
matching ``district.name`` to ``geographic_areas`` (child of country ``HK``,
``level = 'district'``).

Usage::

    export DATABASE_URL=postgresql://...
    python scripts/imports/import_legacy_crm_venues.py /path/to/backup.sql

    # Preview without writing
    python scripts/imports/import_legacy_crm_venues.py /path/to/backup.sql --dry-run

Environment:

- ``DATABASE_URL`` — required (same as Alembic / app).
- ``DATABASE_SSLMODE`` — optional, default ``require``.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from uuid import UUID

# Repo layout: scripts/imports/ -> backend/src
_BACKEND_SRC = Path(__file__).resolve().parents[2] / "backend" / "src"
if str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import GeographicArea, Location


def _iter_mysql_insert_groups(values_sql: str) -> list[str]:
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


def _split_mysql_tuple_fields(inner: str) -> list[str | None]:
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
            fields.append(_parse_sql_atom(raw))
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
        fields.append(_parse_sql_atom(tail))
    return fields


def _parse_sql_atom(raw: str) -> str | None:
    s = raw.strip()
    if s.upper() == "NULL" or s == "":
        return None
    return s


_INSERT_RE = re.compile(
    r"INSERT\s+INTO\s+`(?P<table>[^`]+)`\s+VALUES\s*(?P<rest>.+?);",
    re.IGNORECASE | re.DOTALL,
)


def _extract_insert_statement(sql_text: str, table: str) -> str | None:
    m = _INSERT_RE.search(sql_text)
    while m:
        if m.group("table").lower() == table.lower():
            return m.group(0)
        m = _INSERT_RE.search(sql_text, m.end())
    return None


def _parse_legacy_districts(sql_text: str) -> dict[int, str]:
    stmt = _extract_insert_statement(sql_text, "district")
    if stmt is None:
        msg = "Could not find INSERT INTO `district` in dump."
        raise ValueError(msg)
    m = _INSERT_RE.match(stmt)
    if m is None:
        raise ValueError("Unexpected district INSERT shape.")
    rest = m.group("rest").rstrip()
    if rest.endswith(";"):
        rest = rest[:-1].rstrip()
    groups = _iter_mysql_insert_groups(rest)
    out: dict[int, str] = {}
    for g in groups:
        fields = _split_mysql_tuple_fields(g)
        if len(fields) < 2:
            continue
        did = int(str(fields[0]))
        name = str(fields[1])
        out[did] = name
    return out


def _parse_legacy_venues(sql_text: str) -> list[dict[str, object]]:
    stmt = _extract_insert_statement(sql_text, "venue")
    if stmt is None:
        msg = "Could not find INSERT INTO `venue` in dump."
        raise ValueError(msg)
    m = _INSERT_RE.match(stmt)
    if m is None:
        raise ValueError("Unexpected venue INSERT shape.")
    rest = m.group("rest").rstrip()
    if rest.endswith(";"):
        rest = rest[:-1].rstrip()
    groups = _iter_mysql_insert_groups(rest)
    rows: list[dict[str, object]] = []
    for g in groups:
        fields = _split_mysql_tuple_fields(g)
        if len(fields) < 5:
            continue
        legacy_id = int(str(fields[0]))
        name = str(fields[1]) if fields[1] is not None else ""
        line1 = fields[2]
        line2 = fields[3]
        district_raw = fields[4]
        district_id = int(str(district_raw)) if district_raw is not None else None
        parts = [p for p in (line1, line2) if p]
        address = ", ".join(parts) if parts else None
        rows.append(
            {
                "legacy_id": legacy_id,
                "name": name.strip() or None,
                "address": address,
                "district_id": district_id,
            }
        )
    return rows


def _hk_country_id(session: Session) -> UUID:
    q = select(GeographicArea.id).where(
        GeographicArea.parent_id.is_(None),
        GeographicArea.code == "HK",
        GeographicArea.level == "country",
    )
    row = session.execute(q).scalar_one_or_none()
    if row is None:
        msg = "No geographic_areas row for Hong Kong (code=HK, root). Run migrations."
        raise RuntimeError(msg)
    return UUID(str(row))


def _district_area_map(session: Session, hk_id: UUID) -> dict[str, UUID]:
    q = select(GeographicArea.id, GeographicArea.name).where(
        GeographicArea.parent_id == hk_id,
        GeographicArea.level == "district",
    )
    m: dict[str, UUID] = {}
    for aid, name in session.execute(q).all():
        m[str(name)] = UUID(str(aid))
    return m


def _dedupe_key(name: str | None, address: str | None) -> tuple[str, str]:
    n = (name or "").strip().lower()
    a = (address or "").strip().lower()
    return (n, a)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import legacy CRM venue rows into locations.",
    )
    parser.add_argument(
        "sql_path",
        type=Path,
        help="Path to local MariaDB .sql dump (not committed to git).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and resolve areas but do not insert rows.",
    )
    args = parser.parse_args()
    path: Path = args.sql_path
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        return 1

    sql_text = path.read_text(encoding="utf-8", errors="replace")
    districts = _parse_legacy_districts(sql_text)
    venues = _parse_legacy_venues(sql_text)

    engine = get_engine(use_cache=False)
    inserted = 0
    skipped_dup = 0
    skipped_area = 0

    with Session(engine) as session:
        hk_id = _hk_country_id(session)
        area_by_name = _district_area_map(session, hk_id)

        existing_keys: set[tuple[str, str]] = set()
        for loc in session.execute(select(Location.name, Location.address)).all():
            existing_keys.add(_dedupe_key(loc[0], loc[1]))

        for v in venues:
            did = v["district_id"]
            dname = districts.get(int(did)) if did is not None else None
            area_id = area_by_name.get(dname) if dname else None
            if area_id is None:
                print(
                    f"Skip legacy venue id={v['legacy_id']}: "
                    f"no geographic_areas match for district "
                    f"id={did!r} name={dname!r}",
                    file=sys.stderr,
                )
                skipped_area += 1
                continue

            name = v["name"]
            address = v["address"]
            key = _dedupe_key(name, address)
            if key in existing_keys:
                skipped_dup += 1
                continue

            if args.dry_run:
                print(
                    f"Would insert: {name!r} | {address!r} | area={dname!r}",
                )
                inserted += 1
                existing_keys.add(key)
                continue

            loc = Location(
                area_id=area_id,
                name=name,
                address=address,
                lat=None,
                lng=None,
            )
            session.add(loc)
            session.flush()
            inserted += 1
            existing_keys.add(key)

        if not args.dry_run:
            session.commit()

    print(
        f"Done. inserted={inserted} skipped_duplicate={skipped_dup} "
        f"skipped_no_area={skipped_area} dry_run={args.dry_run}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
