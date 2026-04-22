from __future__ import annotations

from typing import Any

import pytest

from app.api.admin_crm_helpers import (
    FAMILY_RELATIONSHIP_TYPES,
    ORGANIZATION_RELATIONSHIP_TYPES,
    request_id,
    parse_contact_type_filter,
    parse_relationship_type,
)
from app.db.models import RelationshipType
from app.db.models.enums import ContactType
from app.exceptions import ValidationError


def test_request_id_reads_api_gateway_request_id() -> None:
    event: dict[str, Any] = {
        "requestContext": {"requestId": "  req-abc  "},
    }
    assert request_id(event) == "req-abc"


def test_request_id_empty_when_missing() -> None:
    assert request_id({}) == ""


def test_parse_relationship_type_defaults_to_prospect() -> None:
    assert parse_relationship_type(None, field="x") == RelationshipType.PROSPECT
    assert parse_relationship_type("", field="x") == RelationshipType.PROSPECT


def test_parse_relationship_type_accepts_vendor() -> None:
    assert (
        parse_relationship_type("vendor", field="relationship_type")
        == RelationshipType.VENDOR
    )


def test_parse_relationship_type_accepts_client() -> None:
    assert (
        parse_relationship_type("client", field="relationship_type")
        == RelationshipType.CLIENT
    )


def test_parse_relationship_type_family_allowed_subset() -> None:
    assert (
        parse_relationship_type(
            "client",
            field="relationship_type",
            allowed=FAMILY_RELATIONSHIP_TYPES,
        )
        == RelationshipType.CLIENT
    )
    with pytest.raises(ValidationError, match="relationship_type"):
        parse_relationship_type(
            "past_client",
            field="relationship_type",
            allowed=FAMILY_RELATIONSHIP_TYPES,
        )


def test_parse_relationship_type_organization_excludes_past_client() -> None:
    assert (
        parse_relationship_type(
            "partner",
            field="relationship_type",
            allowed=ORGANIZATION_RELATIONSHIP_TYPES,
        )
        == RelationshipType.PARTNER
    )
    with pytest.raises(ValidationError, match="relationship_type"):
        parse_relationship_type(
            "past_client",
            field="relationship_type",
            allowed=ORGANIZATION_RELATIONSHIP_TYPES,
        )


def test_parse_contact_type_filter_empty_means_no_filter() -> None:
    assert parse_contact_type_filter(None) is None
    assert parse_contact_type_filter("") is None
    assert parse_contact_type_filter("  ") is None


def test_parse_contact_type_filter_accepts_known_values() -> None:
    assert parse_contact_type_filter("parent") == ContactType.PARENT
    assert parse_contact_type_filter("CHILD") == ContactType.CHILD


def test_parse_contact_type_filter_rejects_unknown() -> None:
    with pytest.raises(ValidationError, match="contact_type"):
        parse_contact_type_filter("not_a_type")
