from __future__ import annotations

from app.currency_config import clear_currency_config_cache, currency_symbol_for_iso_code


def test_currency_symbol_for_iso_code_uses_shared_config() -> None:
    assert currency_symbol_for_iso_code("HKD") == "HK$"
    assert currency_symbol_for_iso_code("hkd") == "HK$"
    assert currency_symbol_for_iso_code("USD") == "$"
    assert currency_symbol_for_iso_code("  EUR ") == "€"


def test_currency_symbol_for_iso_code_unknown_returns_none() -> None:
    assert currency_symbol_for_iso_code("GBP") is None
    assert currency_symbol_for_iso_code("") is None
    assert currency_symbol_for_iso_code(None) is None


def test_clear_currency_config_cache_is_callable() -> None:
    """Smoke: tests can reset config cache after swapping JSON fixtures."""
    currency_symbol_for_iso_code("HKD")
    clear_currency_config_cache()
    assert currency_symbol_for_iso_code("HKD") == "HK$"
