from __future__ import annotations

import json
from dataclasses import dataclass
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from app.api.admin_request import parse_cursor
from app.api.assets.assets_common import (
    asset_links_expense_attachment,
    paginate_response,
    parse_admin_asset_content_language,
    parse_admin_asset_list_filters,
    parse_create_asset_payload,
    parse_optional_content_language,
    parse_partial_update_asset_payload,
    parse_update_asset_payload,
)
from app.exceptions import ValidationError


@dataclass(frozen=True)
class _DummyAsset:
    id: UUID
    title: str


def _serialize_dummy_asset(item: _DummyAsset) -> dict[str, str]:
    return {"id": str(item.id), "title": item.title}


def test_paginate_response_returns_next_cursor_for_remaining_items() -> None:
    items = [
        _DummyAsset(id=uuid4(), title="one"),
        _DummyAsset(id=uuid4(), title="two"),
        _DummyAsset(id=uuid4(), title="three"),
    ]
    response = paginate_response(
        items=items,
        limit=2,
        event={"headers": {}},
        serializer=_serialize_dummy_asset,
    )

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["items"]) == 2
    assert body["next_cursor"] is not None
    assert parse_cursor(body["next_cursor"]) == items[1].id


def test_paginate_response_returns_null_cursor_for_last_page() -> None:
    items = [
        _DummyAsset(id=uuid4(), title="one"),
        _DummyAsset(id=uuid4(), title="two"),
    ]
    response = paginate_response(
        items=items,
        limit=2,
        event={"headers": {}},
        serializer=_serialize_dummy_asset,
    )

    body = json.loads(response["body"])
    assert body["next_cursor"] is None


def test_paginate_response_merges_extra_fields() -> None:
    items = [_DummyAsset(id=uuid4(), title="one")]
    response = paginate_response(
        items=items,
        limit=2,
        event={"headers": {}},
        serializer=_serialize_dummy_asset,
        extra_fields={"linked_tag_names": ["alpha", "beta"]},
    )

    body = json.loads(response["body"])
    assert body["linked_tag_names"] == ["alpha", "beta"]


def test_parse_partial_update_asset_payload_requires_updatable_field() -> None:
    event = {
        "body": "{}",
        "isBase64Encoded": False,
    }
    with pytest.raises(ValidationError, match="At least one updatable field is required"):
        parse_partial_update_asset_payload(event)


def test_parse_partial_update_asset_payload_accepts_subset_fields() -> None:
    event = {
        "body": json.dumps({"title": "Updated title"}),
        "isBase64Encoded": False,
    }
    payload = parse_partial_update_asset_payload(event)
    assert payload == {"title": "Updated title"}


def test_parse_create_asset_payload_normalizes_resource_key() -> None:
    event = {
        "body": json.dumps(
            {
                "title": "Patience Guide",
                "file_name": "patience-guide.pdf",
                "asset_type": "document",
                "visibility": "restricted",
                "resource_key": "  Patience Free Guide  ",
            }
        ),
        "isBase64Encoded": False,
    }

    payload = parse_create_asset_payload(event)

    assert payload["resource_key"] == "patience-free-guide"


def test_parse_partial_update_asset_payload_supports_clearing_resource_key() -> None:
    event = {
        "body": json.dumps({"resource_key": "   "}),
        "isBase64Encoded": False,
    }

    payload = parse_partial_update_asset_payload(event)

    assert payload == {"resource_key": None}


def test_parse_admin_asset_list_filters_accepts_expense_attachment_tag() -> None:
    event = {
        "queryStringParameters": {"tag_name": "expense_attachment"},
        "headers": {},
    }
    query, visibility, asset_type, tag_name = parse_admin_asset_list_filters(event)
    assert tag_name == "expense_attachment"
    assert query is None


def test_parse_admin_asset_list_filters_accepts_any_tag_name_for_list_validation() -> None:
    event = {
        "queryStringParameters": {"tag_name": "unknown"},
        "headers": {},
    }
    query, visibility, asset_type, tag_name = parse_admin_asset_list_filters(event)
    assert tag_name == "unknown"
    assert query is None


def test_parse_admin_asset_list_filters_rejects_overlong_tag_name() -> None:
    event = {
        "queryStringParameters": {"tag_name": "x" * 101},
        "headers": {},
    }
    with pytest.raises(ValidationError, match="tag_name is too long"):
        parse_admin_asset_list_filters(event)


def test_parse_create_asset_payload_accepts_client_document_tag() -> None:
    event = {
        "body": json.dumps(
            {
                "title": "Guide",
                "file_name": "guide.pdf",
                "asset_type": "document",
                "visibility": "restricted",
                "client_tag": "client_document",
            }
        ),
        "isBase64Encoded": False,
    }
    payload = parse_create_asset_payload(event)
    assert payload["client_tag"] == "client_document"


def test_parse_create_asset_payload_omits_client_tag_when_absent() -> None:
    event = {
        "body": json.dumps(
            {
                "title": "Guide",
                "file_name": "guide.pdf",
                "asset_type": "document",
                "visibility": "restricted",
            }
        ),
        "isBase64Encoded": False,
    }
    payload = parse_create_asset_payload(event)
    assert payload["client_tag"] is None


def test_parse_create_asset_payload_rejects_invalid_client_tag() -> None:
    event = {
        "body": json.dumps(
            {
                "title": "Guide",
                "file_name": "guide.pdf",
                "asset_type": "document",
                "visibility": "restricted",
                "client_tag": "nope",
            }
        ),
        "isBase64Encoded": False,
    }
    with pytest.raises(ValidationError, match="client_tag must be null"):
        parse_create_asset_payload(event)


def test_parse_update_asset_payload_tracks_client_tag_presence() -> None:
    base = {
        "title": "Guide",
        "file_name": "guide.pdf",
        "asset_type": "document",
        "visibility": "restricted",
    }
    without = {
        "body": json.dumps(base),
        "isBase64Encoded": False,
    }
    parsed = parse_update_asset_payload(without)
    assert parsed["client_tag_specified"] is False

    with_tag = {
        "body": json.dumps({**base, "client_tag": None}),
        "isBase64Encoded": False,
    }
    parsed = parse_update_asset_payload(with_tag)
    assert parsed["client_tag_specified"] is True
    assert parsed["client_tag"] is None


def test_parse_partial_update_accepts_client_tag_only() -> None:
    event = {
        "body": json.dumps({"client_tag": "client_document"}),
        "isBase64Encoded": False,
    }
    payload = parse_partial_update_asset_payload(event)
    assert payload["client_tag_specified"] is True
    assert payload["client_tag"] == "client_document"


def test_parse_optional_content_language_accepts_arbitrary_bcp47_for_public_query() -> None:
    assert parse_optional_content_language({"language": "fr"}, "language") == "fr"


def test_parse_admin_asset_content_language_allowlists_admin_writes() -> None:
    assert parse_admin_asset_content_language({"content_language": "en"}, "content_language") == "en"
    assert (
        parse_admin_asset_content_language({"contentLanguage": "zh_HK"}, "contentLanguage")
        == "zh-HK"
    )
    with pytest.raises(ValidationError, match="content_language must be null or one of"):
        parse_admin_asset_content_language({"content_language": "fr"}, "content_language")


def test_parse_create_asset_payload_rejects_disallowed_content_language() -> None:
    event = {
        "body": json.dumps(
            {
                "title": "Guide",
                "file_name": "guide.pdf",
                "asset_type": "document",
                "visibility": "restricted",
                "content_language": "de-AT",
            }
        ),
        "isBase64Encoded": False,
    }
    with pytest.raises(ValidationError, match="content_language must be null or one of"):
        parse_create_asset_payload(event)


def test_asset_links_expense_attachment_detects_tag() -> None:
    asset = SimpleNamespace(
        asset_tags=[
            SimpleNamespace(tag=SimpleNamespace(name="expense_attachment")),
        ]
    )
    assert asset_links_expense_attachment(asset) is True

    other = SimpleNamespace(asset_tags=[SimpleNamespace(tag=SimpleNamespace(name="client_document"))])
    assert asset_links_expense_attachment(other) is False
