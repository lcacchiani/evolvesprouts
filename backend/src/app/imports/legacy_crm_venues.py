"""Parse legacy CRM SQL dumps and apply venue rows to ``locations``.

Pure parsing helpers are side-effect free. Database writes go through ``apply_venues``.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import field
from typing import Final
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GeographicArea
from app.db.models import Location
from app.utils.logging import get_logger

logger = get_logger(__name__)

PREVIEW_MAX_ROWS: Final[int] = 50


@dataclass(frozen=True)
class LegacyVenue:
    """One legacy ``venue`` row from a mysqldump ``INSERT``."""

    legacy_id: int
    name: str | None
    address: str | None
    district_id: int | None
    #: Legacy district label from ``district.name``, if ``district_id`` resolved.
    district_label: str | None = None


@dataclass
class ImportStats:
    """Summary of a legacy venue import run."""

    inserted: int = 0
    skipped_duplicate: int = 0
    skipped_no_area: int = 0
    dry_run: bool = False
    preview: list[str] = field(default_factory=list)


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


# mysqldump often emits:
# - `INSERT INTO `db`.`t` (`c1`,...) VALUES ...` (qualified table name)
# - `INSERT INTO `t` (`c1`,...) VALUES ...`
# - `INSERT INTO t VALUES ...` (unquoted identifiers)
# The first form must not capture `db` as the table name.
_INSERT_RE = re.compile(
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


def _extract_insert_statement(sql_text: str, table: str) -> str | None:
    want = table.lower()
    m = _INSERT_RE.search(sql_text)
    while m:
        if _table_name_from_insert_match(m).lower() == want:
            return m.group(0)
        m = _INSERT_RE.search(sql_text, m.end())
    return None


def parse_legacy_districts(sql_text: str) -> dict[int, str]:
    """Parse ``district`` INSERT rows into ``id -> name``."""
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


def parse_legacy_venues(
    sql_text: str,
    *,
    districts: Mapping[int, str] | None = None,
) -> list[LegacyVenue]:
    """Parse ``venue`` INSERT rows into :class:`LegacyVenue` records.

    If ``districts`` is omitted, :func:`parse_legacy_districts` is run on the same
    dump so each row carries a ``district_label`` when the id maps.
    """
    district_map: Mapping[int, str] = (
        districts if districts is not None else parse_legacy_districts(sql_text)
    )
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
    rows: list[LegacyVenue] = []
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
        dlabel = district_map.get(int(district_id)) if district_id is not None else None
        parts = [p for p in (line1, line2) if p]
        address = ", ".join(parts) if parts else None
        rows.append(
            LegacyVenue(
                legacy_id=legacy_id,
                name=name.strip() or None,
                address=address,
                district_id=district_id,
                district_label=dlabel,
            )
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


def apply_venues(
    session: Session,
    venues: Sequence[LegacyVenue],
    *,
    dry_run: bool,
) -> ImportStats:
    """Insert venues into ``locations``, skipping duplicates and unmapped districts.

    Each :class:`LegacyVenue` should carry ``district_label`` (see
    :func:`parse_legacy_venues`).
    """
    stats = ImportStats(dry_run=dry_run)
    hk_id = _hk_country_id(session)
    area_by_name = _district_area_map(session, hk_id)

    existing_keys: set[tuple[str, str]] = set()
    for row in session.execute(select(Location.name, Location.address)).all():
        existing_keys.add(_dedupe_key(row[0], row[1]))

    for v in venues:
        dname = v.district_label
        area_id = area_by_name.get(dname) if dname else None
        if area_id is None:
            logger.warning(
                "Skipping legacy venue id=%s: no geographic_areas match for "
                "district id=%r name=%r",
                v.legacy_id,
                v.district_id,
                dname,
            )
            stats.skipped_no_area += 1
            continue

        name = v.name
        address = v.address
        key = _dedupe_key(name, address)
        if key in existing_keys:
            stats.skipped_duplicate += 1
            continue

        if dry_run:
            if len(stats.preview) < PREVIEW_MAX_ROWS:
                stats.preview.append(
                    f"Would insert: {name!r} | {address!r} | area={dname!r}"
                )
            stats.inserted += 1
            existing_keys.add(key)
            continue

        new_location = Location(
            area_id=area_id,
            name=name,
            address=address,
            lat=None,
            lng=None,
        )
        session.add(new_location)
        session.flush()
        stats.inserted += 1
        existing_keys.add(key)

    if not dry_run:
        session.commit()

    return stats


__all__ = [
    "PREVIEW_MAX_ROWS",
    "ImportStats",
    "LegacyVenue",
    "apply_venues",
    "parse_legacy_districts",
    "parse_legacy_venues",
]
