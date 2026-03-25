"""Tests for admin expense request payload parsing."""

from __future__ import annotations

import pytest

from app.api.admin_expenses_common import parse_create_payload, parse_update_payload
from app.exceptions import ValidationError


def test_parse_create_payload_requires_vendor_id() -> None:
    with pytest.raises(ValidationError) as exc_info:
        parse_create_payload(
            {
                "attachment_asset_ids": [
                    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                ],
            }
        )
    assert exc_info.value.field == "vendor_id"


def test_parse_update_payload_allows_omitted_vendor_id() -> None:
    payload = parse_update_payload({"invoice_number": "INV-1"})
    assert payload["vendor_id"] is None
