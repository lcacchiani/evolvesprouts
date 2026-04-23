"""Legacy event stack mysqldump parsing and pure mapping helpers."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC
from datetime import datetime
from decimal import Decimal
from typing import Final

from app.db.models.enums import DiscountType
from app.db.models.enums import EnrollmentStatus
from app.db.models.enums import EventCategory
from app.db.models.enums import ServiceDeliveryMode
from app.imports import mysqldump
from app.imports.entities._mysqldump_rows import iter_row_dicts
from app.imports.entities._legacy_family_common import _parse_dt
from app.imports.entities._legacy_family_common import _parse_int
from app.utils.logging import get_logger

logger = get_logger(__name__)

LEGACY_IMPORT_CREATED_BY = "legacy-import"

# --- delivery_mode heuristic (module-level for tests) ---
DELIVERY_MODE_ONLINE_TOKENS: Final[tuple[str, ...]] = (
    "online",
    "webinar",
    "zoom",
    "virtual",
    "livestream",
    "remote",
)
DELIVERY_MODE_HYBRID_TOKENS: Final[tuple[str, ...]] = (
    "hybrid",
    "online & in-person",
    "online and in person",
)


def _normalize_tokens(*parts: str | None) -> str:
    chunks: list[str] = []
    for p in parts:
        if not p:
            continue
        chunks.append(str(p).strip().lower())
    return " ".join(chunks)


def _infer_delivery_mode(
    title: str | None,
    description: str | None,
    venue_name: str | None,
) -> ServiceDeliveryMode:
    blob = _normalize_tokens(title, description, venue_name)
    for tok in DELIVERY_MODE_HYBRID_TOKENS:
        if tok in blob:
            return ServiceDeliveryMode.HYBRID
    for tok in DELIVERY_MODE_ONLINE_TOKENS:
        if tok in blob:
            return ServiceDeliveryMode.ONLINE
    return ServiceDeliveryMode.IN_PERSON


# legacy enum string (lowercase) -> EventCategory (verify against dump)
_LEGACY_EVENT_CATEGORY_MAP: dict[str, EventCategory] = {
    "workshop": EventCategory.WORKSHOP,
    "webinar": EventCategory.WEBINAR,
    "open_house": EventCategory.OPEN_HOUSE,
    "open-house": EventCategory.OPEN_HOUSE,
    "open_day": EventCategory.OPEN_HOUSE,
    "open-day": EventCategory.OPEN_HOUSE,
    "open day": EventCategory.OPEN_HOUSE,
    "meetup": EventCategory.COMMUNITY_MEETUP,
    "community": EventCategory.COMMUNITY_MEETUP,
    "community_meetup": EventCategory.COMMUNITY_MEETUP,
    "community-meetup": EventCategory.COMMUNITY_MEETUP,
    "other": EventCategory.OTHER,
}


def _map_event_category(legacy_value: str | None) -> EventCategory:
    if legacy_value is None or str(legacy_value).strip() == "":
        return EventCategory.OTHER
    key = str(legacy_value).strip().lower().replace(" ", "_").replace("-", "_")
    mapped = _LEGACY_EVENT_CATEGORY_MAP.get(key)
    if mapped is not None:
        return mapped
    # tolerate legacy values already normalized with underscores
    mapped = _LEGACY_EVENT_CATEGORY_MAP.get(str(legacy_value).strip().lower())
    if mapped is not None:
        return mapped
    logger.warning(
        "unknown legacy event.category=%r; mapping to other",
        legacy_value,
    )
    return EventCategory.OTHER


def _map_enrollment_status(legacy: str | None) -> EnrollmentStatus:
    if legacy is None:
        return EnrollmentStatus.REGISTERED
    s = str(legacy).strip().lower()
    if s in {"cancelled", "void", "refunded"}:
        return EnrollmentStatus.CANCELLED
    if s in {"confirmed", "paid", "booked"}:
        return EnrollmentStatus.CONFIRMED
    if s in {"attended", "completed", "shown"}:
        return EnrollmentStatus.COMPLETED
    if s in {"waitlist", "waiting", "waitlisted"}:
        return EnrollmentStatus.WAITLISTED
    if s == "":
        return EnrollmentStatus.REGISTERED
    logger.warning(
        "unknown legacy registration.status=%r; mapping to registered",
        legacy,
    )
    return EnrollmentStatus.REGISTERED


def _map_discount_type(legacy: str | None) -> DiscountType | None:
    if legacy is None:
        return None
    s = str(legacy).strip().lower()
    if s == "percentage":
        return DiscountType.PERCENTAGE
    if s == "absolute":
        return DiscountType.ABSOLUTE
    if s == "referral":
        return DiscountType.REFERRAL
    return None


_ISO4217 = frozenset(
    {
        "AED",
        "AFN",
        "ALL",
        "AMD",
        "ANG",
        "AOA",
        "ARS",
        "AUD",
        "AWG",
        "AZN",
        "BAM",
        "BBD",
        "BDT",
        "BGN",
        "BHD",
        "BIF",
        "BMD",
        "BND",
        "BOB",
        "BRL",
        "BSD",
        "BTN",
        "BWP",
        "BYN",
        "BZD",
        "CAD",
        "CDF",
        "CHF",
        "CLP",
        "CNY",
        "COP",
        "CRC",
        "CUC",
        "CUP",
        "CVE",
        "CZK",
        "DJF",
        "DKK",
        "DOP",
        "DZD",
        "EGP",
        "ERN",
        "ETB",
        "EUR",
        "FJD",
        "FKP",
        "GBP",
        "GEL",
        "GHS",
        "GIP",
        "GMD",
        "GNF",
        "GTQ",
        "GYD",
        "HKD",
        "HNL",
        "HRK",
        "HTG",
        "HUF",
        "IDR",
        "ILS",
        "INR",
        "IQD",
        "IRR",
        "ISK",
        "JMD",
        "JOD",
        "JPY",
        "KES",
        "KGS",
        "KHR",
        "KMF",
        "KPW",
        "KRW",
        "KWD",
        "KYD",
        "KZT",
        "LAK",
        "LBP",
        "LKR",
        "LRD",
        "LSL",
        "LYD",
        "MAD",
        "MDL",
        "MGA",
        "MKD",
        "MMK",
        "MNT",
        "MOP",
        "MRU",
        "MUR",
        "MVR",
        "MWK",
        "MXN",
        "MYR",
        "MZN",
        "NAD",
        "NGN",
        "NIO",
        "NOK",
        "NPR",
        "NZD",
        "OMR",
        "PAB",
        "PEN",
        "PGK",
        "PHP",
        "PKR",
        "PLN",
        "PYG",
        "QAR",
        "RON",
        "RSD",
        "RUB",
        "RWF",
        "SAR",
        "SBD",
        "SCR",
        "SDG",
        "SEK",
        "SGD",
        "SHP",
        "SLE",
        "SLL",
        "SOS",
        "SRD",
        "SSP",
        "STN",
        "SVC",
        "SYP",
        "SZL",
        "THB",
        "TJS",
        "TMT",
        "TND",
        "TOP",
        "TRY",
        "TTD",
        "TWD",
        "TZS",
        "UAH",
        "UGX",
        "USD",
        "UYU",
        "UZS",
        "VES",
        "VND",
        "VUV",
        "WST",
        "XAF",
        "XCD",
        "XOF",
        "XPF",
        "YER",
        "ZAR",
        "ZMW",
        "ZWL",
    },
)


def _normalize_currency(raw: str | None, *, default: str | None = "HKD") -> str | None:
    if raw is None:
        return default
    c = str(raw).strip().upper()
    if len(c) == 3 and c in _ISO4217:
        return c
    if default is not None:
        logger.debug("Unrecognized currency %r; using %s", raw, default)
    return default


def _slugify_event_title(title: str) -> str | None:
    s = str(title).strip()
    if not s:
        return None
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or None


def _parse_decimal(raw: str | None) -> Decimal | None:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return Decimal(str(raw).strip())
    except Exception:
        return None


def _parse_dt_utc_assumed(raw: str | None) -> datetime | None:
    dt = _parse_dt(raw)
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


@dataclass(frozen=True)
class LegacyLabel:
    legacy_id: int
    name: str | None
    entity: str | None
    deleted_at: str | None


# CREATE TABLE `label` (approximate column order for positional fallback — verify dump).
# id, name, entity, … , deleted_at
_LABEL_POS: dict[int, str] = {
    0: "id",
    1: "name",
    2: "entity",
    3: "deleted_at",
}


@dataclass(frozen=True)
class LegacyEvent:
    legacy_id: int
    title: str | None
    description: str | None
    category: str | None
    default_price: Decimal | None
    default_currency: str | None
    default_venue_id: int | None
    default_venue_name: str | None
    organization_id: int | None
    deleted_at: str | None


# CREATE TABLE `event` — verify column order in dump; used when INSERT omits column list.
_EVENT_POS: dict[int, str] = {
    0: "id",
    1: "name",
    2: "description",
    3: "category",
    4: "default_price",
    5: "default_currency",
    6: "default_venue_id",
    7: "organization_id",
    8: "deleted_at",
}


@dataclass(frozen=True)
class LegacyEventDate:
    legacy_id: int
    event_id: int | None
    starts_at: datetime | None
    ends_at: datetime | None
    venue_id: int | None
    capacity: int | None
    cancelled_at: str | None
    deleted_at: str | None
    notes: str | None
    external_url: str | None


_EVENT_DATE_POS: dict[int, str] = {
    0: "id",
    1: "event_id",
    2: "starts_at",
    3: "ends_at",
    4: "venue_id",
    5: "capacity",
    6: "cancelled_at",
    7: "deleted_at",
    8: "notes",
    9: "external_url",
}


@dataclass(frozen=True)
class LegacyEventLabel:
    event_id: int | None
    event_date_id: int | None
    label_id: int


_EVENT_LABEL_POS_EVENT_FIRST: dict[int, str] = {
    0: "event_id",
    1: "label_id",
}
_EVENT_LABEL_POS_DATE_FIRST: dict[int, str] = {
    0: "event_date_id",
    1: "label_id",
}


@dataclass(frozen=True)
class LegacyRegistration:
    legacy_id: int
    event_date_id: int | None
    person_id: int | None
    family_id: int | None
    organization_id: int | None
    status: str | None
    price: Decimal | None
    currency: str | None
    paid_at: str | None
    cancelled_at: str | None
    notes: str | None
    deleted_at: str | None
    discount_id: int | None
    created_at: datetime | None


_REGISTRATION_POS: dict[int, str] = {
    0: "id",
    1: "event_date_id",
    2: "person_id",
    3: "family_id",
    4: "organization_id",
    5: "status",
    6: "price",
    7: "currency",
    8: "paid_at",
    9: "cancelled_at",
    10: "notes",
    11: "deleted_at",
    12: "discount_id",
    13: "created_at",
}


@dataclass(frozen=True)
class LegacyDiscount:
    legacy_id: int
    code: str | None
    type: str | None
    value: Decimal | None
    valid_from: str | None
    valid_to: str | None
    max_uses: int | None
    event_id: int | None
    event_date_id: int | None
    deleted_at: str | None


_DISCOUNT_POS: dict[int, str] = {
    0: "id",
    1: "code",
    2: "type",
    3: "value",
    4: "valid_from",
    5: "valid_to",
    6: "max_uses",
    7: "event_id",
    8: "event_date_id",
    9: "deleted_at",
}


def _legacy_event_title(rd: dict[str, str | None]) -> str | None:
    for key in ("title", "name"):
        v = rd.get(key)
        if v is not None and str(v).strip():
            return str(v).strip()
    return None


def parse_legacy_venue_id_to_name(sql_text: str) -> dict[int, str]:
    """Map legacy venue id → trimmed name for delivery-mode heuristics."""
    stmt = mysqldump.extract_insert_statement(sql_text, "venue")
    if stmt is None:
        return {}
    rest = mysqldump.extract_values_sql_fragment(stmt)
    out: dict[int, str] = {}
    for g in mysqldump.iter_groups(rest):
        fields = mysqldump.split_fields(g)
        if len(fields) < 2:
            continue
        try:
            vid = int(str(fields[0]))
        except ValueError:
            continue
        nm = fields[1]
        if nm is not None:
            out[vid] = str(nm).strip()
    return out


def parse_legacy_labels(sql_text: str) -> list[LegacyLabel]:
    rows: list[LegacyLabel] = []
    for rd in iter_row_dicts(sql_text, "label", positional=_LABEL_POS):
        lid = _parse_int(rd.get("id"))
        if lid is None:
            continue
        ent = (str(rd["entity"]).strip().lower() if rd.get("entity") else None)
        if ent not in {"category", "tag"}:
            continue
        rows.append(
            LegacyLabel(
                legacy_id=lid,
                name=(str(rd["name"]).strip() if rd.get("name") else None) or None,
                entity=ent,
                deleted_at=rd.get("deleted_at"),
            ),
        )
    return rows


def parse_legacy_events(sql_text: str) -> list[LegacyEvent]:
    venue_names = parse_legacy_venue_id_to_name(sql_text)
    rows: list[LegacyEvent] = []
    for rd in iter_row_dicts(sql_text, "event", positional=_EVENT_POS):
        lid = _parse_int(rd.get("id"))
        if lid is None:
            continue
        dv = _parse_int(rd.get("default_venue_id"))
        vname = venue_names.get(dv) if dv is not None else None
        rows.append(
            LegacyEvent(
                legacy_id=lid,
                title=_legacy_event_title(rd),
                description=rd.get("description"),
                category=(str(rd["category"]).strip() if rd.get("category") else None),
                default_price=_parse_decimal(rd.get("default_price")),
                default_currency=rd.get("default_currency"),
                default_venue_id=dv,
                default_venue_name=vname,
                organization_id=_parse_int(rd.get("organization_id")),
                deleted_at=rd.get("deleted_at"),
            ),
        )
    return rows


def parse_legacy_event_dates(sql_text: str) -> list[LegacyEventDate]:
    rows: list[LegacyEventDate] = []
    for rd in iter_row_dicts(sql_text, "event_date", positional=_EVENT_DATE_POS):
        lid = _parse_int(rd.get("id"))
        if lid is None:
            continue
        cap = _parse_int(rd.get("capacity"))
        rows.append(
            LegacyEventDate(
                legacy_id=lid,
                event_id=_parse_int(rd.get("event_id")),
                starts_at=_parse_dt_utc_assumed(rd.get("starts_at")),
                ends_at=_parse_dt_utc_assumed(rd.get("ends_at")),
                venue_id=_parse_int(rd.get("venue_id")),
                capacity=cap,
                cancelled_at=rd.get("cancelled_at"),
                deleted_at=rd.get("deleted_at"),
                notes=rd.get("notes"),
                external_url=rd.get("external_url"),
            ),
        )
    return rows


def _event_label_positional_from_create(sql_text: str) -> dict[int, str]:
    cols = mysqldump.parse_create_table_column_names(sql_text, "event_label")
    if cols is None:
        return _EVENT_LABEL_POS_EVENT_FIRST
    lower = [c.lower() for c in cols]
    if "event_date_id" in lower and lower.index("event_date_id") < lower.index(
        "label_id",
    ):
        return {0: "event_date_id", 1: "label_id"}
    if "event_id" in lower:
        return {0: "event_id", 1: "label_id"}
    return _EVENT_LABEL_POS_EVENT_FIRST


def parse_legacy_event_labels(sql_text: str) -> list[LegacyEventLabel]:
    pos = _event_label_positional_from_create(sql_text)
    rows: list[LegacyEventLabel] = []
    for rd in iter_row_dicts(sql_text, "event_label", positional=pos):
        eid = _parse_int(rd.get("event_id"))
        did = _parse_int(rd.get("event_date_id"))
        lab = _parse_int(rd.get("label_id"))
        if lab is None:
            continue
        rows.append(
            LegacyEventLabel(
                event_id=eid,
                event_date_id=did,
                label_id=lab,
            ),
        )
    return rows


def parse_legacy_registrations(sql_text: str) -> list[LegacyRegistration]:
    rows: list[LegacyRegistration] = []
    for rd in iter_row_dicts(sql_text, "registration", positional=_REGISTRATION_POS):
        lid = _parse_int(rd.get("id"))
        if lid is None:
            continue
        rows.append(
            LegacyRegistration(
                legacy_id=lid,
                event_date_id=_parse_int(rd.get("event_date_id")),
                person_id=_parse_int(rd.get("person_id")),
                family_id=_parse_int(rd.get("family_id")),
                organization_id=_parse_int(rd.get("organization_id")),
                status=(str(rd["status"]).strip() if rd.get("status") else None),
                price=_parse_decimal(rd.get("price")),
                currency=rd.get("currency"),
                paid_at=rd.get("paid_at"),
                cancelled_at=rd.get("cancelled_at"),
                notes=rd.get("notes"),
                deleted_at=rd.get("deleted_at"),
                discount_id=_parse_int(rd.get("discount_id")),
                created_at=_parse_dt_utc_assumed(rd.get("created_at")),
            ),
        )
    return rows


def parse_legacy_discounts(sql_text: str) -> list[LegacyDiscount]:
    rows: list[LegacyDiscount] = []
    for rd in iter_row_dicts(sql_text, "discount", positional=_DISCOUNT_POS):
        lid = _parse_int(rd.get("id"))
        if lid is None:
            continue
        rows.append(
            LegacyDiscount(
                legacy_id=lid,
                code=rd.get("code"),
                type=(str(rd["type"]).strip().lower() if rd.get("type") else None),
                value=_parse_decimal(rd.get("value")),
                valid_from=rd.get("valid_from"),
                valid_to=rd.get("valid_to"),
                max_uses=_parse_int(rd.get("max_uses")),
                event_id=_parse_int(rd.get("event_id")),
                event_date_id=_parse_int(rd.get("event_date_id")),
                deleted_at=rd.get("deleted_at"),
            ),
        )
    return rows
