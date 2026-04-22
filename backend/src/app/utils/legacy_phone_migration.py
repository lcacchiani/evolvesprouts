"""Legacy ``contacts.phone`` parsing used only by Alembic migration 0033."""

from __future__ import annotations

import re

_LEGACY_IMPORTER_PHONE_RE = re.compile(r"^\+(\d{1,3})-(.+)$")
_DEFAULT_REGION = "HK"


def parse_legacy_contact_phone_for_migration(phone: str) -> tuple[str, str] | None:
    """Parse a legacy free-text phone for migration backfill (soft ``is_possible`` gate)."""
    import phonenumbers
    from phonenumbers.phonenumberutil import NumberParseException

    raw = phone.strip()
    if not raw:
        return None

    parsed = None
    try:
        parsed = phonenumbers.parse(raw, None)
    except NumberParseException:
        parsed = None

    if parsed is None:
        m = _LEGACY_IMPORTER_PHONE_RE.match(raw)
        if m:
            rebuilt = f"+{m.group(1)}{m.group(2)}"
            try:
                parsed = phonenumbers.parse(rebuilt, None)
            except NumberParseException:
                parsed = None

    if parsed is None:
        try:
            parsed = phonenumbers.parse(raw, _DEFAULT_REGION)
        except NumberParseException:
            return None

    if not phonenumbers.is_possible_number(parsed):
        return None

    region_code = phonenumbers.region_code_for_number(parsed)
    if not region_code or region_code == "ZZ":
        region_code = _DEFAULT_REGION
    national = phonenumbers.national_significant_number(parsed)
    if not national:
        return None
    return region_code, national
