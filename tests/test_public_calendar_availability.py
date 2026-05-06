"""Tests for GET /v1/calendar/availability."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest

from app.api.public_calendar_availability import handle_public_calendar_availability
from app.utils import CACHE_CONTROL_EDGE_CACHEABLE_GET

_EXPECTED_CACHE_CONTROL_INTRO = CACHE_CONTROL_EDGE_CACHEABLE_GET


class _Ctx:
    def __init__(self, *_a: object, **_k: object) -> None:
        pass

    def __enter__(self) -> object:
        return object()

    def __exit__(self, *_a: object) -> None:
        return None


def test_purpose_required_400(
    api_gateway_event: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.public_calendar_availability.Session", lambda _e: _Ctx()
    )
    monkeypatch.setattr(
        "app.api.public_calendar_availability.get_engine", lambda: object()
    )
    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/availability",
        query_params={"from": "2026-05-01", "to": "2026-05-02"},
    )
    resp = handle_public_calendar_availability(event, "GET")
    assert resp["statusCode"] == 400
    assert json.loads(resp["body"])["error"] == "purpose query parameter is required"
    assert resp["headers"]["Cache-Control"] == "no-store"


def test_unknown_purpose_400(api_gateway_event: Any) -> None:
    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/availability",
        query_params={"purpose": "nope", "from": "2026-05-01", "to": "2026-05-02"},
    )
    resp = handle_public_calendar_availability(event, "GET")
    assert resp["statusCode"] == 400
    assert json.loads(resp["body"])["error"] == "Unsupported purpose"
    assert resp["headers"]["Cache-Control"] == "no-store"


def test_consultation_200_envelope_and_no_store(
    api_gateway_event: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.public_calendar_availability.Session", lambda _e: _Ctx()
    )
    monkeypatch.setattr(
        "app.api.public_calendar_availability.get_engine", lambda: object()
    )
    t0 = datetime(2026, 5, 6, 1, 0, tzinfo=UTC)
    t1 = datetime(2026, 5, 6, 4, 0, tzinfo=UTC)
    monkeypatch.setattr(
        "app.services.calendar_blockers.compute_available_consultation_slots",
        lambda *_a, **_k: [(t0, t1)],
    )
    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/availability",
        query_params={
            "purpose": "consultation_booking",
            "from": "2026-05-06",
            "to": "2026-05-06",
        },
    )
    resp = handle_public_calendar_availability(event, "GET")
    assert resp["statusCode"] == 200
    assert resp["headers"]["Cache-Control"] == "no-store"
    body = json.loads(resp["body"])
    assert "slots" in body and "meta" in body
    assert body["meta"]["purpose"] == "consultation_booking"
    assert body["meta"]["lead_calendar_days"] == 2
    assert "lead_hours" not in body["meta"]


def test_intro_200_envelope_and_public_cache(
    api_gateway_event: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.public_calendar_availability.Session", lambda _e: _Ctx()
    )
    monkeypatch.setattr(
        "app.api.public_calendar_availability.get_engine", lambda: object()
    )
    t0 = datetime(2026, 5, 4, 2, 0, tzinfo=UTC)
    t1 = datetime(2026, 5, 4, 2, 15, tzinfo=UTC)
    monkeypatch.setattr(
        "app.services.intro_call_slots.compute_available_intro_call_slots",
        lambda *_a, **_k: [(t0, t1)],
    )
    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/availability",
        query_params={
            "purpose": "intro_call_booking",
            "from": "2026-05-04",
            "to": "2026-05-04",
        },
    )
    resp = handle_public_calendar_availability(event, "GET")
    assert resp["statusCode"] == 200
    assert resp["headers"]["Cache-Control"] == _EXPECTED_CACHE_CONTROL_INTRO
    body = json.loads(resp["body"])
    assert body["meta"]["max_forward_days"] == 35
    assert body["meta"]["lead_hours"] == 2
    assert "lead_calendar_days" not in body["meta"]


def test_invalid_from_400(api_gateway_event: Any) -> None:
    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/availability",
        query_params={"purpose": "intro_call_booking", "from": "not-a-date"},
    )
    resp = handle_public_calendar_availability(event, "GET")
    assert resp["statusCode"] == 400
    assert json.loads(resp["body"])["error"] == "Invalid from date"


def test_post_405(api_gateway_event: Any) -> None:
    event = api_gateway_event(method="POST", path="/v1/calendar/availability")
    resp = handle_public_calendar_availability(event, "POST")
    assert resp["statusCode"] == 405
    assert resp["headers"]["Cache-Control"] == "no-store"


def test_default_to_uses_spec_horizon_consultation(
    api_gateway_event: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Omit `to` → to == from + default_horizon_days (120) for consultation."""
    seen: dict[str, Any] = {}

    def _spy(session: object, from_date: object, to_date: object, now: object) -> list:
        seen["to"] = to_date
        return []

    monkeypatch.setattr(
        "app.services.calendar_blockers.compute_available_consultation_slots",
        _spy,
    )
    monkeypatch.setattr(
        "app.api.public_calendar_availability.Session", lambda _e: _Ctx()
    )
    monkeypatch.setattr(
        "app.api.public_calendar_availability.get_engine", lambda: object()
    )
    event = api_gateway_event(
        method="GET",
        path="/v1/calendar/availability",
        query_params={"purpose": "consultation_booking", "from": "2026-01-01"},
    )
    resp = handle_public_calendar_availability(event, "GET")
    assert resp["statusCode"] == 200
    assert str(seen["to"]) == "2026-05-01"  # 120 days from 2026-01-01
