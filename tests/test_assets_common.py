from __future__ import annotations

import json
from dataclasses import dataclass
from uuid import UUID, uuid4

from app.api.admin_request import parse_cursor
from app.api.assets.assets_common import paginate_response


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
