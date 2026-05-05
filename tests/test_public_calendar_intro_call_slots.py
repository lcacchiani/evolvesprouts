"""Tests for GET /v1/calendar/intro-call-slots."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest

from app.api.public_calendar_intro_call_slots import (
    handle_public_calendar_intro_call_slots,
)
from app.utils import CACHE_CONTROL_EDGE_CACHEABLE_GET

_EXPECTED_CACHE_CONTROL_SUCCESS = CACHE_CONTROL_EDGE_CACHEABLE_GET


class _Ctx:
    def __init__(self, *_a: object, **_k: object) -> None:
        pass

    def __enter__(self) -> object:
        return object()

    def __exit__(self, *_a: object) -> None:
        return None


def test_get_returns_sorted_slots(
    monkeypatch: pytest.MonkeyPatch, api_gateway_event: Any
) -> None:
    monkeypatch.setattr(
        "app.api.public_calendar_intro_call_slots.Session", lambda _e: _Ctx()
    )
    monkeypatch.setattr(
        "app.api.public_calendar_intro_call_slots.get_engine", lambda: object()
    )

    t0 = datetime(2026, 5, 4, 2, 0, tzinfo=UTC)
    t1 = datetime(2026, 5, 4, 2, 15, tzinfo=UTC)
    monkeypatch.setattr(
        "app.api.public_calendar_intro_call_slots.compute_available_intro_call_slots",
        lambda *_a, **_k: [(t0, t1)],
    )

    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/intro-call-slots",
        query_params={
            "from": "2026-05-04",
            "to": "2026-05-04",
        },
    )
    resp = handle_public_calendar_intro_call_slots(event, "GET")
    assert resp["statusCode"] == 200
    assert resp["headers"]["Cache-Control"] == _EXPECTED_CACHE_CONTROL_SUCCESS
    body = json.loads(resp["body"])
    assert body["slots"][0]["start_iso"].endswith("Z")


def test_post_returns_405(api_gateway_event: Any) -> None:
    event = api_gateway_event(method="POST", path="/v1/calendar/intro-call-slots")
    resp = handle_public_calendar_intro_call_slots(event, "POST")
    assert resp["statusCode"] == 405
    assert resp["headers"]["Cache-Control"] == "no-store"


def test_invalid_from_returns_400(api_gateway_event: Any) -> None:
    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/intro-call-slots",
        query_params={"from": "not-a-date"},
    )
    resp = handle_public_calendar_intro_call_slots(event, "GET")
    assert resp["statusCode"] == 400
    assert resp["headers"]["Cache-Control"] == "no-store"


def test_span_too_large_returns_400(api_gateway_event: Any) -> None:
    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/intro-call-slots",
        query_params={"from": "2026-05-01", "to": "2026-07-01"},
    )
    resp = handle_public_calendar_intro_call_slots(event, "GET")
    assert resp["statusCode"] == 400
    assert resp["headers"]["Cache-Control"] == "no-store"
