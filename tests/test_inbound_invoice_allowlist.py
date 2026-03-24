from __future__ import annotations

from app.services.inbound_invoice_allowlist import (
    inbound_invoice_sender_is_allowed,
    load_inbound_invoice_sender_patterns,
)


def test_load_patterns_empty_when_unset(monkeypatch: object) -> None:
    monkeypatch.delenv("INBOUND_INVOICE_ALLOWED_SENDER_PATTERNS", raising=False)
    assert load_inbound_invoice_sender_patterns() == ()


def test_load_patterns_splits_and_lowercases(monkeypatch: object) -> None:
    monkeypatch.setenv(
        "INBOUND_INVOICE_ALLOWED_SENDER_PATTERNS",
        " Foo@Bar.com , @corp.example ",
    )
    assert load_inbound_invoice_sender_patterns() == ("foo@bar.com", "@corp.example")


def test_allowed_when_no_patterns() -> None:
    assert inbound_invoice_sender_is_allowed(
        envelope_from="anyone@evil.com",
        header_from=None,
        patterns=(),
    )


def test_rejected_when_patterns_but_no_addresses() -> None:
    assert not inbound_invoice_sender_is_allowed(
        envelope_from=None,
        header_from="   ",
        patterns=("@trusted.com",),
    )


def test_matches_header_from_substring() -> None:
    assert inbound_invoice_sender_is_allowed(
        envelope_from="forwarder@mail.com",
        header_from="Billing <invoices@vendor.com>",
        patterns=("@vendor.com",),
    )


def test_matches_envelope_when_header_differs() -> None:
    assert inbound_invoice_sender_is_allowed(
        envelope_from="billing@trusted.example",
        header_from="spoof@other.com",
        patterns=("billing@",),
    )


def test_both_must_miss_for_rejection() -> None:
    assert inbound_invoice_sender_is_allowed(
        envelope_from="a@b.com",
        header_from="x@y.com",
        patterns=("@b.com",),
    )
