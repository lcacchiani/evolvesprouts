"""Tests for bulk expense import worker helpers."""

from __future__ import annotations

from app.services.bulk_expense_import_runner import sanitize_bulk_import_error_message


def test_sanitize_bulk_import_error_message_non_empty() -> None:
    out = sanitize_bulk_import_error_message("Something went wrong with vendor@example.com")
    assert out.endswith("***")
    assert len(out) <= 8000


def test_sanitize_bulk_import_error_message_empty_defaults() -> None:
    assert sanitize_bulk_import_error_message("") == "An error occurred."
