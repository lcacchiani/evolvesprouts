from __future__ import annotations

from uuid import uuid4

import pytest

from app.api.admin_service_instance_partners import parse_partner_organization_ids
from app.api.admin_services_payload_utils import parse_optional_external_url
from app.exceptions import ValidationError


def test_parse_optional_external_url_accepts_http_https() -> None:
    assert parse_optional_external_url("  https://example.com/path  ", "external_url") == (
        "https://example.com/path"
    )
    assert parse_optional_external_url("http://a.example/x", "external_url") == "http://a.example/x"


def test_parse_optional_external_url_rejects_non_http_scheme() -> None:
    with pytest.raises(ValidationError) as exc:
        parse_optional_external_url("ftp://example.com", "external_url")
    assert exc.value.field == "external_url"


def test_parse_partner_organization_ids_dedupes_preserving_order() -> None:
    a = uuid4()
    b = uuid4()
    raw = parse_partner_organization_ids(
        {"partner_organization_ids": [str(a), str(b), str(a), str(b)]}
    )
    assert raw == [a, b]


def test_parse_partner_organization_ids_rejects_empty_string_entry() -> None:
    with pytest.raises(ValidationError) as exc:
        parse_partner_organization_ids(
            {"partner_organization_ids": [str(uuid4()), "  "]}
        )
    assert exc.value.field == "partner_organization_ids"
