"""Shared legacy ``family`` / ``person`` / ``country`` mysqldump parsing."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from datetime import datetime

from app.imports import mysqldump
from app.imports.entities.venues import parse_legacy_districts


@dataclass(frozen=True)
class LegacyFamilyRow:
    """One legacy ``family`` row."""

    legacy_id: int
    name: str | None
    kind: str | None
    district_id: int | None
    district_label: str | None
    address_line1: str | None
    address_line2: str | None
    latitude: str | None
    longitude: str | None
    deleted_at: str | None


@dataclass(frozen=True)
class LegacyPersonRow:
    """One legacy ``person`` row."""

    legacy_id: int
    family_id: int | None
    kind: str | None
    first_name: str | None
    last_name: str | None
    email: str | None
    instagram_id: str | None
    date_of_birth: date | None
    phone: str | None
    phone_country_code_id: int | None
    occupation: str | None
    company: str | None
    referral_source: str | None
    referral_person_id: int | None
    is_newsletter_subscribed: int | None
    deleted_at: str | None


@dataclass(frozen=True)
class LegacyNoteRow:
    """One legacy ``note`` row."""

    legacy_id: int
    created_at: datetime | None
    took_at: datetime
    content: str


# Real mysqldump column order (no column list) — see legacy ``CREATE TABLE`` in dump.
# id, parent_id, created_at, created_by, deleted_at, deleted_by,
# name, latitude, longitude, address_line1, address_line2,
# district_id, kind, company_id, postal_code
_FAMILY_POS: dict[int, str] = {
    0: "id",
    1: "parent_id",
    2: "created_at",
    3: "created_by",
    4: "deleted_at",
    5: "deleted_by",
    6: "name",
    7: "latitude",
    8: "longitude",
    9: "address_line1",
    10: "address_line2",
    11: "district_id",
    12: "kind",
    13: "company_id",
    14: "postal_code",
}

# Tests / hand-written dumps may use a shortened 9-column layout (explicit lists).
_FAMILY_POS_LEGACY_TEST: dict[int, str] = {
    0: "id",
    1: "name",
    2: "kind",
    3: "district_id",
    4: "address_line1",
    5: "address_line2",
    6: "latitude",
    7: "longitude",
    8: "deleted_at",
}

# Default person layout when CREATE TABLE is missing — wide row matching typical CRM dumps.
_PERSON_POS: dict[int, str] = {
    0: "id",
    1: "family_id",
    2: "kind",
    3: "first_name",
    4: "last_name",
    5: "email",
    6: "instagram_id",
    7: "date_of_birth",
    8: "phone",
    9: "phone_country_code_id",
    10: "occupation",
    11: "company",
    12: "referral_source",
    13: "referral_person_id",
    14: "is_newsletter_subscribed",
    15: "deleted_at",
}

# id, iso3, name, region_id, dial_code (real dump)
_COUNTRY_POS: dict[int, str] = {
    0: "id",
    1: "iso3",
    2: "name",
    3: "region_id",
    4: "dial_code",
}

_NOTE_POS: dict[int, str] = {
    0: "id",
    1: "created_at",
    2: "took_at",
    3: "content",
}

_PN_POS: dict[int, str] = {
    0: "note_id",
    1: "person_id",
}


def _parse_int(raw: str | None) -> int | None:
    if raw is None or raw == "":
        return None
    return int(str(raw).strip())


def _parse_date(raw: str | None) -> date | None:
    if raw is None or raw == "":
        return None
    s = str(raw).strip()
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        try:
            return date.fromisoformat(s[:10])
        except ValueError:
            return None
    return None


def _parse_dt(raw: str | None) -> datetime | None:
    if raw is None or raw == "":
        return None
    s = str(raw).strip()
    if len(s) >= 19 and s[10] == " ":
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if "T" in s:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _require_dt(raw: str | None, *, field: str) -> datetime:
    dt = _parse_dt(raw)
    if dt is None:
        msg = f"Could not parse {field} as timestamp: {raw!r}"
        raise ValueError(msg)
    return dt


def _resolve_column_names(
    sql_text: str,
    table: str,
    stmt: str,
    fields: list[str | None],
    positional: dict[int, str],
) -> list[str] | None:
    insert_cols = mysqldump.parse_insert_column_names(stmt)
    if insert_cols is not None and len(insert_cols) == len(fields):
        return insert_cols
    create_cols = mysqldump.parse_create_table_column_names(sql_text, table)
    if create_cols is not None and len(create_cols) == len(fields):
        return create_cols
    if table == "family":
        if len(fields) == len(_FAMILY_POS):
            return [_FAMILY_POS[i] for i in range(len(_FAMILY_POS))]
        if len(fields) == len(_FAMILY_POS_LEGACY_TEST):
            return [
                _FAMILY_POS_LEGACY_TEST[i] for i in range(len(_FAMILY_POS_LEGACY_TEST))
            ]
    if len(fields) == len(positional):
        return [positional[i] for i in range(len(fields))]
    return None


def _row_dict(
    sql_text: str,
    table: str,
    stmt: str,
    fields: list[str | None],
    positional: dict[int, str],
) -> dict[str, str | None]:
    names = _resolve_column_names(sql_text, table, stmt, fields, positional)
    if names is not None and len(names) == len(fields):
        return {names[i]: fields[i] for i in range(len(fields))}
    return mysqldump.row_dict_from_fields(None, fields, positional_fallback=positional)


def _extract_insert(sql_text: str, table: str) -> str:
    stmt = mysqldump.extract_insert_statement(sql_text, table)
    if stmt is None:
        msg = f"Could not find INSERT INTO `{table}` in dump."
        raise ValueError(msg)
    return stmt


def _table_positional(table: str) -> dict[int, str]:
    if table == "family":
        return _FAMILY_POS
    if table == "person":
        return _PERSON_POS
    if table == "country":
        return _COUNTRY_POS
    if table == "note":
        return _NOTE_POS
    if table == "person_note":
        return _PN_POS
    return {}


def _iter_row_dicts(
    sql_text: str,
    table: str,
) -> list[dict[str, str | None]]:
    stmt = _extract_insert(sql_text, table)
    pos = _table_positional(table)
    values_sql = mysqldump.extract_values_sql_fragment(stmt)
    out: list[dict[str, str | None]] = []
    for g in mysqldump.iter_groups(values_sql):
        fields = mysqldump.split_fields(g)
        out.append(_row_dict(sql_text, table, stmt, fields, pos))
    return out


def parse_legacy_family_rows(sql_text: str) -> list[LegacyFamilyRow]:
    districts = parse_legacy_districts(sql_text)
    rows: list[LegacyFamilyRow] = []
    for rd in _iter_row_dicts(sql_text, "family"):
        lid = _parse_int(rd.get("id"))
        if lid is None:
            continue
        did = _parse_int(rd.get("district_id"))
        dlabel = districts.get(did) if did is not None else None
        rows.append(
            LegacyFamilyRow(
                legacy_id=lid,
                name=(str(rd["name"]).strip() if rd.get("name") else None) or None,
                kind=(str(rd["kind"]).strip() if rd.get("kind") else None) or None,
                district_id=did,
                district_label=dlabel,
                address_line1=rd.get("address_line1"),
                address_line2=rd.get("address_line2"),
                latitude=rd.get("latitude"),
                longitude=rd.get("longitude"),
                deleted_at=rd.get("deleted_at"),
            )
        )
    return rows


def legacy_family_id_to_person_kinds(sql_text: str) -> dict[int, set[str]]:
    """Read-only scan of ``person`` rows: map legacy family id → distinct kinds."""
    out: dict[int, set[str]] = {}
    for rd in _iter_row_dicts(sql_text, "person"):
        fid = _parse_int(rd.get("family_id"))
        if fid is None:
            continue
        k = rd.get("kind")
        kind = str(k).strip().lower() if k else ""
        if not kind:
            continue
        out.setdefault(fid, set()).add(kind)
    return out


def parse_legacy_person_rows(sql_text: str) -> list[LegacyPersonRow]:
    rows: list[LegacyPersonRow] = []
    for rd in _iter_row_dicts(sql_text, "person"):
        lid = _parse_int(rd.get("id"))
        if lid is None:
            continue
        ns = rd.get("is_newsletter_subscribed")
        ns_int: int | None = None
        if ns is not None and str(ns).strip() != "":
            try:
                ns_int = int(str(ns).strip())
            except ValueError:
                ns_int = None
        rows.append(
            LegacyPersonRow(
                legacy_id=lid,
                family_id=_parse_int(rd.get("family_id")),
                kind=(str(rd["kind"]).strip().lower() if rd.get("kind") else None),
                first_name=rd.get("first_name"),
                last_name=rd.get("last_name"),
                email=rd.get("email"),
                instagram_id=rd.get("instagram_id"),
                date_of_birth=_parse_date(rd.get("date_of_birth")),
                phone=rd.get("phone"),
                phone_country_code_id=_parse_int(rd.get("phone_country_code_id")),
                occupation=rd.get("occupation"),
                company=rd.get("company"),
                referral_source=(
                    str(rd["referral_source"]).strip().lower()
                    if rd.get("referral_source")
                    else None
                ),
                referral_person_id=_parse_int(rd.get("referral_person_id")),
                is_newsletter_subscribed=ns_int,
                deleted_at=rd.get("deleted_at"),
            )
        )
    return rows


def parse_legacy_country_dial_codes(sql_text: str) -> dict[int, str]:
    if mysqldump.extract_insert_statement(sql_text, "country") is None:
        return {}
    out: dict[int, str] = {}
    for rd in _iter_row_dicts(sql_text, "country"):
        cid = _parse_int(rd.get("id"))
        dial = rd.get("dial_code")
        if cid is None or dial is None:
            continue
        out[cid] = str(dial).strip().lstrip("+")
    return out


def parse_legacy_notes(sql_text: str) -> list[LegacyNoteRow]:
    rows: list[LegacyNoteRow] = []
    for rd in _iter_row_dicts(sql_text, "note"):
        lid = _parse_int(rd.get("id"))
        if lid is None:
            continue
        rows.append(
            LegacyNoteRow(
                legacy_id=lid,
                created_at=_parse_dt(rd.get("created_at")),
                took_at=_require_dt(rd.get("took_at"), field="took_at"),
                content=str(rd["content"] or ""),
            )
        )
    return rows


def parse_legacy_person_notes(sql_text: str) -> list[tuple[int, int]]:
    """Return (note_id, person_id) pairs from ``person_note``."""
    stmt = mysqldump.extract_insert_statement(sql_text, "person_note")
    if stmt is None:
        return []
    pairs: list[tuple[int, int]] = []
    for rd in _iter_row_dicts(sql_text, "person_note"):
        nid = _parse_int(rd.get("note_id"))
        pid = _parse_int(rd.get("person_id"))
        if nid is None or pid is None:
            continue
        pairs.append((nid, pid))
    return pairs


def note_id_to_person_ids(pairs: list[tuple[int, int]]) -> dict[int, list[int]]:
    m: dict[int, list[int]] = {}
    for nid, pid in pairs:
        m.setdefault(nid, []).append(pid)
    return m
