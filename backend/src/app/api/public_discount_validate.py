"""Native discount code validation for public booking (Aurora-backed)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.api.admin_request import parse_body
from app.api.admin_validators import validate_string_length
from app.db.engine import get_engine
from app.db.models import DiscountCode
from app.db.models.enums import DiscountType
from app.db.repositories import DiscountCodeRepository
from app.utils import json_response

_MAX_CODE_LENGTH = 100

_CURRENCY_SYMBOLS: dict[str, str] = {
    "HKD": "HK$",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "CNY": "¥",
    "JPY": "¥",
    "AUD": "A$",
    "CAD": "C$",
    "SGD": "S$",
    "NZD": "NZ$",
}


def handle_public_discount_validate(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Validate a discount code; response shape matches legacy DiscountRule."""
    if method != "POST":
        return json_response(405, {"error": "Method not allowed"}, event=event)

    body = parse_body(event)
    code = validate_string_length(
        body.get("code"),
        "code",
        _MAX_CODE_LENGTH,
        required=True,
    )
    assert code is not None

    with Session(get_engine()) as session:
        repository = DiscountCodeRepository(session)
        row = repository.get_by_code(code)
        if row is None or not _is_usable_now(row):
            return json_response(
                404,
                {"error": "Discount code not found or inactive"},
                event=event,
            )

        rule = _discount_rule_payload(row)
        return json_response(
            200,
            {
                "valid": True,
                "is_valid": True,
                "data": rule,
                "discount": rule,
            },
            event=event,
        )


def _is_usable_now(row: DiscountCode) -> bool:
    if not row.active:
        return False
    now = datetime.now(UTC)
    if row.valid_from is not None and row.valid_from > now:
        return False
    if row.valid_until is not None and row.valid_until < now:
        return False
    if row.max_uses is not None and row.current_uses >= row.max_uses:
        return False
    return True


def _discount_rule_payload(row: DiscountCode) -> dict[str, Any]:
    is_percentage = row.discount_type == DiscountType.PERCENTAGE
    amount = float(row.discount_value)
    currency_code = None if is_percentage else (row.currency or None)
    currency_symbol = (
        None if is_percentage else _currency_symbol_for_code(currency_code)
    )
    return {
        "code": row.code,
        "name": row.description,
        "amount": amount,
        "is_percentage": is_percentage,
        "currency_code": currency_code,
        "currency_symbol": currency_symbol,
    }


def _currency_symbol_for_code(code: str | None) -> str | None:
    if not code:
        return None
    return _CURRENCY_SYMBOLS.get(code.strip().upper())
