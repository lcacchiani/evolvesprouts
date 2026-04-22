"""Phone number helpers (ISO region + national significant number)."""

from __future__ import annotations

import os
import re

import phonenumbers
from phonenumbers import PhoneNumberFormat
from phonenumbers.phonenumberutil import NumberParseException


def default_phone_region() -> str:
    """ISO 3166-1 alpha-2 default region for parsing when the client omits region."""
    raw = os.environ.get("DEFAULT_PHONE_REGION", "").strip().upper()
    return raw if len(raw) == 2 and raw.isalpha() else "HK"


def format_phone_e164(region: str | None, national_number: str | None) -> str | None:
    """Format stored region + national digits to E.164, or None if incomplete."""
    if not region or not national_number:
        return None
    region_u = region.strip().upper()
    digits = national_number.strip()
    if len(region_u) != 2 or not digits.isdigit():
        return None
    try:
        parsed = phonenumbers.parse(digits, region_u)
    except NumberParseException:
        return None
    if not (
        phonenumbers.is_valid_number(parsed) or phonenumbers.is_possible_number(parsed)
    ):
        return None
    return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)


def format_phone_international(
    region: str | None, national_number: str | None
) -> str | None:
    """Pretty international display for internal notification emails."""
    if not region or not national_number:
        return None
    region_u = region.strip().upper()
    digits = national_number.strip()
    if len(region_u) != 2 or not digits.isdigit():
        return None
    try:
        parsed = phonenumbers.parse(digits, region_u)
    except NumberParseException:
        return None
    if not (
        phonenumbers.is_valid_number(parsed) or phonenumbers.is_possible_number(parsed)
    ):
        return None
    return phonenumbers.format_number(parsed, PhoneNumberFormat.INTERNATIONAL)


def strip_phone_search_term(term: str) -> str:
    """Keep only ASCII digits and a leading ``+`` (admin contact search normaliser)."""
    return re.sub(r"[^\d+]", "", term.strip())


def country_calling_codes_longest_first() -> tuple[int, ...]:
    """Distinct country calling codes, longest digit-length first (for ``+`` prefix match)."""
    codes: set[int] = set()
    for region in phonenumbers.SUPPORTED_REGIONS:
        c: int | None
        try:
            c = phonenumbers.country_code_for_region(region)
        except Exception:
            c = None
        if c and c > 0:
            codes.add(int(c))
    return tuple(
        sorted(codes, key=lambda c: (len(str(c)), c), reverse=True),
    )


_CC_CACHE: tuple[int, ...] | None = None


def _calling_codes_cached() -> tuple[int, ...]:
    global _CC_CACHE
    if _CC_CACHE is None:
        _CC_CACHE = country_calling_codes_longest_first()
    return _CC_CACHE


def try_parse_international_digit_string(
    digits: str,
) -> tuple[str, str] | None:
    """If ``digits`` is an international number (country code + NSN), return (region, nsn)."""
    if not digits.isdigit() or len(digits) < 8:
        return None
    for cc in _calling_codes_cached():
        cc_s = str(cc)
        if not digits.startswith(cc_s):
            continue
        national = digits[len(cc_s) :]
        if not national:
            continue
        region = phonenumbers.region_code_for_country_code(cc)
        if not region:
            continue
        try:
            parsed = phonenumbers.parse(national, region)
        except NumberParseException:
            continue
        if not (
            phonenumbers.is_valid_number(parsed)
            or phonenumbers.is_possible_number(parsed)
        ):
            continue
        resolved = phonenumbers.region_code_for_number(parsed)
        if not resolved or resolved == "ZZ":
            resolved = region
        return resolved, phonenumbers.national_significant_number(parsed)
    return None
