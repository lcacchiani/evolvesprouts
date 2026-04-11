from __future__ import annotations

from typing import Any

import pytest

from app.api.admin_crm_helpers import crm_request_id, parse_crm_relationship_type
from app.db.models import RelationshipType
from app.exceptions import ValidationError


def test_crm_request_id_reads_api_gateway_request_id() -> None:
    event: dict[str, Any] = {
        "requestContext": {"requestId": "  req-abc  "},
    }
    assert crm_request_id(event) == "req-abc"


def test_crm_request_id_empty_when_missing() -> None:
    assert crm_request_id({}) == ""


def test_parse_crm_relationship_type_defaults_to_prospect() -> None:
    assert parse_crm_relationship_type(None, field="x") == RelationshipType.PROSPECT
    assert parse_crm_relationship_type("", field="x") == RelationshipType.PROSPECT


def test_parse_crm_relationship_type_forbids_vendor_when_configured() -> None:
    with pytest.raises(ValidationError, match="Finance"):
        parse_crm_relationship_type("vendor", field="relationship_type", forbid_vendor=True)


def test_parse_crm_relationship_type_allows_non_vendor() -> None:
    assert (
        parse_crm_relationship_type("client", field="relationship_type", forbid_vendor=True)
        == RelationshipType.CLIENT
    )
