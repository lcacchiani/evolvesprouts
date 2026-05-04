"""EMVCo / FPS QR payload assembly (Python port of ``fps-generator.js``).

Mirrors the booking-modal / email path in ``apps/public_www/src/lib/fps-qr-code.ts``:
dynamic initiation point (12), merchant account 26 with unique id ``hk.com.hkicl`` and
mobile identifier ``03``, currency HKD, optional transaction amount, country HK,
merchant name and city, then CRC-16/CCITT-FALSE over the assembled prefix including
the ``6304`` tag (same algorithm as module 2 in ``public/scripts/fps-generator.js``).
"""

from __future__ import annotations

import re
from decimal import Decimal

# TLV ids (aligned with fps-generator.js module 0)
_FORMAT_INDICATOR = "00"
_INITIATION_POINT = "01"
_MERCHANT_ACCOUNT = "26"
_MERCHANT_ACCOUNT_UNIQUE = "00"
_MERCHANT_ACCOUNT_IDENTIFIER_MOBILE = "03"
_MERCHANT_CATEGORY_CODE = "52"
_TRANSACTION_CURRENCY = "53"
_TRANSACTION_AMOUNT = "54"
_COUNTRY_CODE = "58"
_MERCHANT_NAME = "59"
_MERCHANT_CITY = "60"
_CYCLIC_REDUNDANCY_CHECK = "63"

_DYNAMIC_QR_CODE = "12"

_FPS_UNIQUE_ID = "hk.com.hkicl"
_FPS_CURRENCY_NUMERIC = {"HKD": "344"}

# CRC-16/CCITT-FALSE table from fps-generator.js (module 2)
_CRC_TABLE: tuple[int, ...] = (
    0,
    4129,
    8258,
    12387,
    16516,
    20645,
    24774,
    28903,
    33032,
    37161,
    41290,
    45419,
    49548,
    53677,
    57806,
    61935,
    4657,
    528,
    12915,
    8786,
    21173,
    17044,
    29431,
    25302,
    37689,
    33560,
    45947,
    41818,
    54205,
    50076,
    62463,
    58334,
    9314,
    13379,
    1056,
    5121,
    25830,
    29895,
    17572,
    21637,
    42346,
    46411,
    34088,
    38153,
    58862,
    62927,
    50604,
    54669,
    13907,
    9842,
    5649,
    1584,
    30423,
    26358,
    22165,
    18100,
    46939,
    42874,
    38681,
    34616,
    63455,
    59390,
    55197,
    51132,
    18628,
    22757,
    26758,
    30887,
    2112,
    6241,
    10242,
    14371,
    51660,
    55789,
    59790,
    63919,
    35144,
    39273,
    43274,
    47403,
    23285,
    19156,
    31415,
    27286,
    6769,
    2640,
    14899,
    10770,
    56317,
    52188,
    64447,
    60318,
    39801,
    35672,
    47931,
    43802,
    27814,
    31879,
    19684,
    23749,
    11298,
    15363,
    3168,
    7233,
    60846,
    64911,
    52716,
    56781,
    44330,
    48395,
    36200,
    40265,
    32407,
    28342,
    24277,
    20212,
    15891,
    11826,
    7761,
    3696,
    65439,
    61374,
    57309,
    53244,
    48923,
    44858,
    40793,
    36728,
    37256,
    33193,
    45514,
    41451,
    53516,
    49453,
    61774,
    57711,
    4224,
    161,
    12482,
    8419,
    20484,
    16421,
    28742,
    24679,
    33721,
    37784,
    41979,
    46042,
    49981,
    54044,
    58239,
    62302,
    689,
    4752,
    8947,
    13010,
    16949,
    21012,
    25207,
    29270,
    46570,
    42443,
    38312,
    34185,
    62830,
    58703,
    54572,
    50445,
    13538,
    9411,
    5280,
    1153,
    29798,
    25671,
    21540,
    17413,
    42971,
    47098,
    34713,
    38840,
    59231,
    63358,
    50973,
    55100,
    9939,
    14066,
    1681,
    5808,
    26199,
    30326,
    17941,
    22068,
    55628,
    51565,
    63758,
    59695,
    39368,
    35305,
    47498,
    43435,
    22596,
    18533,
    30726,
    26663,
    6336,
    2273,
    14466,
    10403,
    52093,
    56156,
    60223,
    64286,
    35833,
    39896,
    43963,
    48026,
    19061,
    23124,
    27191,
    31254,
    2801,
    6864,
    10931,
    14994,
    64814,
    60687,
    56684,
    52557,
    48554,
    44427,
    40424,
    36297,
    31782,
    27655,
    23652,
    19525,
    15522,
    11395,
    7392,
    3265,
    61215,
    65342,
    53085,
    57212,
    44955,
    49082,
    36825,
    40952,
    28183,
    32310,
    20053,
    24180,
    11923,
    16050,
    3793,
    7920,
)


def _crc16_ccitt_false(data: bytes) -> str:
    """Same CRC as fps-generator.js module 2 (init 0xFFFF, per-byte update)."""
    n = 65535
    for byte in data:
        if byte > 255:
            msg = "CRC input must be single-byte characters"
            raise ValueError(msg)
        e = (byte ^ (n >> 8)) & 255
        n = _CRC_TABLE[e] ^ ((n << 8) & 0xFFFF_FFFF)
        n &= 0xFFFF
    return f"{n & 0xFFFF:04X}"


def _number_to_valid_id(length: int) -> str:
    if length < 0 or length > 99:
        length = 0
    return f"{length:02d}"


def _is_alphanumeric_special(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9.@_+-]+", value))


def _format_amount_for_tag(amount: Decimal) -> str | None:
    """Match JS ``setNumeric`` for non-string input: ``t.toString()``."""
    if amount <= 0:
        return None
    s = format(amount, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".") or "0"
    if not re.fullmatch(r"[0-9.]+", s):
        return None
    if len(s) > 13:
        return None
    if float(s) <= 0:
        return None
    return s


def _normalize_mobile_e164_local(raw: str) -> str | None:
    """Normalize to ``+852-XXXXXXXX`` (8 digits), matching ``setMerchantAccount`` mobile branch."""
    t = raw.strip()
    if re.fullmatch(r"[0-9]{8}", t):
        return f"+852-{t}"
    if re.fullmatch(r"852[0-9]{8}", t):
        return f"+{t[:3]}-{t[3:]}"
    if re.fullmatch(r"\+852-[0-9]{8}", t):
        return t
    return None


def _payload(tag_id: str, content: str) -> str:
    return f"{tag_id}{_number_to_valid_id(len(content))}{content}"


def build_fps_payload(
    merchant_name: str,
    mobile_e164_local: str,
    amount: Decimal | None,
    currency: str = "HKD",
) -> str | None:
    """Build FPS EMVCo payload string, or ``None`` when inputs are invalid.

    ``mobile_e164_local`` accepts ``85291234567``, ``91234567``, or ``+852-91234567``.
    ``amount`` omitted or ``None`` skips tag 54 (matches optional amount in generator).
    """
    code = currency.strip().upper()
    if code != "HKD":
        return None
    cur_num = _FPS_CURRENCY_NUMERIC.get(code)
    if not cur_num:
        return None

    name = merchant_name.strip()
    if not name or len(name) > 25 or not _is_alphanumeric_special(name):
        return None

    mobile_norm = _normalize_mobile_e164_local(mobile_e164_local)
    if not mobile_norm or not re.fullmatch(r"[0-9+-]+", mobile_norm):
        return None

    inner = _payload(_MERCHANT_ACCOUNT_UNIQUE, _FPS_UNIQUE_ID) + _payload(
        _MERCHANT_ACCOUNT_IDENTIFIER_MOBILE,
        mobile_norm,
    )
    if len(inner) > 99:
        return None

    fmt = "01"
    t = _payload(_FORMAT_INDICATOR, fmt)
    t += _payload(_INITIATION_POINT, _DYNAMIC_QR_CODE)
    t += _payload(_MERCHANT_ACCOUNT, inner)
    t += _payload(_MERCHANT_CATEGORY_CODE, "0000")
    t += _payload(_TRANSACTION_CURRENCY, cur_num)

    if amount is not None:
        amt_s = _format_amount_for_tag(amount)
        if amt_s is None:
            return None
        t += _payload(_TRANSACTION_AMOUNT, amt_s)

    t += _payload(_COUNTRY_CODE, "HK")
    t += _payload(_MERCHANT_NAME, name)
    t += _payload(_MERCHANT_CITY, "HK")

    crc_input = (t + _CYCLIC_REDUNDANCY_CHECK + "04").encode("ascii")
    crc_hex = _crc16_ccitt_false(crc_input)
    t += _payload(_CYCLIC_REDUNDANCY_CHECK, crc_hex)
    return t
