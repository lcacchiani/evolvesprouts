"""Unit tests for ``fps_qr_payload`` (EMVCo / FPS string builder)."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.fps_qr_payload import build_fps_payload


def test_mobile_normalization_variants() -> None:
    p1 = build_fps_payload("Acme", "85291234567", Decimal("1"), currency="HKD")
    p2 = build_fps_payload("Acme", "91234567", Decimal("1"), currency="HKD")
    p3 = build_fps_payload("Acme", "+852-91234567", Decimal("1"), currency="HKD")
    assert p1 == p2 == p3
    assert p1 is not None
    assert "+852-91234567" in p1


@pytest.mark.parametrize(
    "raw",
    [
        "+85291234567",
        "1234567",
        "8512345678",
        "",
        "  ",
    ],
)
def test_mobile_invalid_returns_none(raw: str) -> None:
    assert build_fps_payload("Acme", raw, Decimal("1"), currency="HKD") is None


def test_currency_non_hkd_returns_none() -> None:
    assert (
        build_fps_payload("Acme", "91234567", Decimal("1"), currency="USD") is None
    )


def test_amount_zero_omits_tag54() -> None:
    """JS booking path uses positive amounts; zero total invoices skip FPS upstream."""
    with_amount = build_fps_payload("Acme", "91234567", Decimal("10.5"), currency="HKD")
    no_amount = build_fps_payload("Acme", "91234567", None, currency="HKD")
    assert with_amount is not None and no_amount is not None
    cur = "5303344"
    pos_w = with_amount.index(cur) + len(cur)
    pos_n = no_amount.index(cur) + len(cur)
    assert with_amount[pos_w:].startswith("540410.5")
    assert no_amount[pos_n:].startswith("5802HK")


def test_amount_formatting_strips_trailing_zeros() -> None:
    p = build_fps_payload("Acme", "91234567", Decimal("100.00"), currency="HKD")
    assert p is not None
    assert "5403100" in p


def test_amount_non_positive_returns_none() -> None:
    assert build_fps_payload("Acme", "91234567", Decimal("0"), currency="HKD") is None
    assert build_fps_payload("Acme", "91234567", Decimal("-1"), currency="HKD") is None


def test_merchant_name_validation() -> None:
    assert build_fps_payload("", "91234567", Decimal("1"), currency="HKD") is None
    assert build_fps_payload("Bad space", "91234567", Decimal("1"), currency="HKD") is None


def test_fps_payload_crc_matches_js_reference() -> None:
    """Golden string from the bundled ``fps-generator.js`` + same inputs as Python."""
    expected = (
        "00020101021226330012hk.com.hkicl0313+852-912345675204000053033445405100.5"
        "5802HK5912TestMerchant6002HK6304C8BC"
    )
    got = build_fps_payload(
        "TestMerchant",
        "85291234567",
        Decimal("100.5"),
        currency="HKD",
    )
    assert got == expected
