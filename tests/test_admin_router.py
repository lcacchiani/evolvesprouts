from __future__ import annotations

import json

from app.api.admin import _match_handler, _requires_json_content_type, _safe_handler


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
        "/v1/admin/leads",
        "/v1/admin/leads/analytics",
        "/v1/admin/leads/export",
        "/v1/admin/leads/abc",
        "/v1/admin/leads/abc/notes",
        "/v1/admin/users",
        "/v1/admin/vendors",
        "/v1/admin/vendors/abc",
        "/v1/user/assets/abc/download",
        "/v1/assets/share/token-123",
        "/v1/assets/public/abc/download",
        "/v1/media-request",
        "/v1/reservations",
        "/v1/reservations/payment-intent",
        "/v1/legacy/reservations",
        "/v1/legacy/contact-us",
        "/v1/legacy/discounts/validate",
        "/www/v1/legacy/reservations",
        "/www/v1/legacy/contact-us",
        "/www/v1/legacy/discounts/validate",
        "/v1/mailchimp/webhook",
        "/www/v1/media-request",
        "/www/v1/reservations",
        "/www/v1/reservations/payment-intent",
    )
    for path in routes:
        handler = _match_handler(event=event, method="GET", path=path)
        assert handler is not None


def test_match_handler_treats_exact_public_post_routes_as_exact_path_only() -> None:
    event = {"headers": {}}
    assert _match_handler(event=event, method="POST", path="/v1/reservations") is not None
    assert (
        _match_handler(event=event, method="POST", path="/v1/reservations/payment-intent")
        is not None
    )
    assert _match_handler(event=event, method="POST", path="/v1/media-request") is not None
    assert (
        _match_handler(event=event, method="POST", path="/v1/mailchimp/webhook")
        is not None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/www/v1/reservations/payment-intent"
        )
        is not None
    )
    assert (
        _match_handler(event=event, method="POST", path="/www/v1/media-request")
        is not None
    )
    assert (
        _match_handler(event=event, method="POST", path="/v1/legacy/reservations")
        is not None
    )
    assert (
        _match_handler(event=event, method="POST", path="/v1/legacy/contact-us")
        is not None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/v1/legacy/discounts/validate"
        )
        is not None
    )
    assert (
        _match_handler(event=event, method="POST", path="/www/v1/legacy/reservations")
        is not None
    )
    assert (
        _match_handler(event=event, method="POST", path="/www/v1/legacy/contact-us")
        is not None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/www/v1/legacy/discounts/validate"
        )
        is not None
    )
    assert (
        _match_handler(event=event, method="POST", path="/v1/reservations/extra") is None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/v1/reservations/payment-intent/extra"
        )
        is None
    )
    assert (
        _match_handler(event=event, method="POST", path="/v1/media-request/extra")
        is None
    )
    assert (
        _match_handler(event=event, method="POST", path="/v1/mailchimp/webhook/extra")
        is None
    )
    assert (
        _match_handler(event=event, method="POST", path="/www/v1/media-request/extra")
        is None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/v1/legacy/reservations/extra"
        )
        is None
    )
    assert (
        _match_handler(event=event, method="POST", path="/v1/legacy/contact-us/extra")
        is None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/v1/legacy/discounts/validate/extra"
        )
        is None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/www/v1/legacy/reservations/extra"
        )
        is None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/www/v1/legacy/contact-us/extra"
        )
        is None
    )
    assert (
        _match_handler(
            event=event,
            method="POST",
            path="/www/v1/legacy/discounts/validate/extra",
        )
        is None
    )
    assert (
        _match_handler(
            event=event, method="POST", path="/www/v1/reservations/payment-intent/extra"
        )
        is None
    )


def test_requires_json_content_type_skips_mailchimp_webhook() -> None:
    assert _requires_json_content_type("/v1/mailchimp/webhook", "POST") is False
    assert _requires_json_content_type("/v1/media-request", "POST") is True
