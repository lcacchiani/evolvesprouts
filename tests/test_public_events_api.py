from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from app.api import public_events
from app.db.models import ServiceType


def _instance_row(
    *,
    status: Any,
    with_eventbrite_url: bool = False,
    delivery_mode_value: str = "in_person",
    max_capacity: int | None = 10,
    slug: str | None = "spring-workshop",
    landing_page: str | None = "spring-workshop",
) -> Any:
    starts = datetime(2026, 4, 20, 18, 0, tzinfo=UTC)
    ends = datetime(2026, 4, 20, 20, 0, tzinfo=UTC)
    location = SimpleNamespace(name="Central Studio", address="123 Main St")
    service = SimpleNamespace(
        title="Parent Service",
        description="Parent description",
        service_type=ServiceType.EVENT,
        event_details=SimpleNamespace(event_category=SimpleNamespace(value="workshop")),
        delivery_mode=SimpleNamespace(value=delivery_mode_value),
    )
    return SimpleNamespace(
        id=uuid4(),
        title="Spring Workshop",
        slug=slug,
        landing_page=landing_page,
        description="Learn together",
        status=status,
        service=service,
        max_capacity=max_capacity,
        session_slots=[
            SimpleNamespace(
                id=uuid4(),
                sort_order=0,
                starts_at=starts,
                ends_at=ends,
                location=location,
            )
        ],
        location=location,
        ticket_tiers=[
            SimpleNamespace(
                id=uuid4(),
                sort_order=0,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
                price=Decimal("250.00"),
                currency="HKD",
            )
        ],
        eventbrite_event_url="https://www.eventbrite.com/e/demo"
        if with_eventbrite_url
        else None,
        delivery_mode=SimpleNamespace(value=delivery_mode_value),
    )


def test_handle_public_events_rejects_non_get(api_gateway_event: Any) -> None:
    response = public_events.handle_public_events(
        api_gateway_event(method="POST", path="/v1/calendar/events"),
        "POST",
    )
    assert response["statusCode"] == 405


def test_handle_public_events_returns_items(monkeypatch: Any, api_gateway_event: Any) -> None:
    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_event_instances_for_public_feed(self, *, limit: int, now: datetime) -> list[Any]:
            assert limit == 100
            assert isinstance(now, datetime)
            return [
                _instance_row(status=public_events.InstanceStatus.OPEN, with_eventbrite_url=True),
                _instance_row(status=public_events.InstanceStatus.FULL),
            ]

        def get_enrollment_count(self, instance_id: Any) -> int:
            return 1

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    response = public_events.handle_public_events(
        api_gateway_event(method="GET", path="/v1/calendar/events"),
        "GET",
    )
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "items" in body
    assert len(body["items"]) == 2
    assert body["items"][0]["external_url"] == "https://www.eventbrite.com/e/demo"
    assert body["items"][0]["slug"] == "spring-workshop"
    assert body["items"][0]["landing_page"] == "spring-workshop"
    assert body["items"][0]["spaces_total"] == 10
    assert body["items"][0]["spaces_left"] == 9
    assert body["items"][1]["booking_status"] == "fully_booked"
