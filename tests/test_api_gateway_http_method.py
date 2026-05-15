"""Tests for api_gateway_http_method helper."""

from __future__ import annotations

from typing import Any

from app.utils.responses import api_gateway_http_method


def test_api_gateway_http_method_rest_proxy_uppercases() -> None:
    event: dict[str, Any] = {"httpMethod": "delete"}
    assert api_gateway_http_method(event) == "DELETE"


def test_api_gateway_http_method_http_api_v2() -> None:
    event: dict[str, Any] = {
        "requestContext": {"http": {"method": "DELETE"}},
    }
    assert api_gateway_http_method(event) == "DELETE"


def test_api_gateway_http_method_rest_takes_precedence_over_v2() -> None:
    event: dict[str, Any] = {
        "httpMethod": "GET",
        "requestContext": {"http": {"method": "DELETE"}},
    }
    assert api_gateway_http_method(event) == "GET"


def test_api_gateway_http_method_missing_returns_empty() -> None:
    assert api_gateway_http_method({}) == ""
