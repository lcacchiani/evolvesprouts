from __future__ import annotations

import json

from app.api.admin import _match_handler, _safe_handler


def test_safe_handler_hides_internal_exception_details() -> None:
    event = {"headers": {}}

    response = _safe_handler(lambda: (_ for _ in ()).throw(RuntimeError("db leaked")), event)

    assert response["statusCode"] == 500
    body = json.loads(response["body"])
    assert body == {"error": "Internal server error"}
    assert "detail" not in body


def test_match_handler_routes_asset_prefix_paths() -> None:
    event = {"headers": {}}
    routes = (
        "/v1/admin/assets/abc",
        "/v1/admin/geographic-areas",
        "/v1/admin/locations",
        "/v1/admin/locations/abc",
        "/v1/user/assets/abc/download",
        "/v1/assets/share/token-123",
        "/v1/assets/public/abc/download",
        "/v1/media-request",
    )
    for path in routes:
        handler = _match_handler(event=event, method="GET", path=path)
        assert handler is not None


def test_match_handler_treats_exact_public_post_routes_as_exact_path_only() -> None:
    event = {"headers": {}}
    assert _match_handler(event=event, method="POST", path="/v1/reservations") is not None
    assert _match_handler(event=event, method="POST", path="/v1/media-request") is not None
    assert (
        _match_handler(event=event, method="POST", path="/v1/reservations/extra") is None
    )
    assert (
        _match_handler(event=event, method="POST", path="/v1/media-request/extra")
        is None
    )
