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
    location = SimpleNamespace(
        name="Central Studio", address="123 Main St", lat=None, lng=None
    )
    service = SimpleNamespace(
        title="Parent Service",
        description="Parent description",
        service_type=ServiceType.EVENT,
        slug=None,
        booking_system=None,
        event_details=SimpleNamespace(event_category=SimpleNamespace(value="workshop")),
        delivery_mode=SimpleNamespace(value=delivery_mode_value),
        service_tier=None,
        location=None,
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
        external_url=None,
        cohort=None,
        instance_tags=[],
        partner_organization_links=[],
        delivery_mode=SimpleNamespace(value=delivery_mode_value),
    )


def test_handle_public_events_rejects_non_get(api_gateway_event: Any) -> None:
    response = public_events.handle_public_events(
        api_gateway_event(method="POST", path="/v1/calendar/public"),
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

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            assert limit == 100
            assert isinstance(now, datetime)
            assert landing_page is None
            assert service_types is None
            assert service_key is None
            return [
                _instance_row(status=public_events.InstanceStatus.OPEN, with_eventbrite_url=True),
                _instance_row(status=public_events.InstanceStatus.FULL),
            ]

        def get_enrollment_counts_for_instances(self, instance_ids: list[Any]) -> dict[Any, int]:
            assert len(instance_ids) == 2
            return {iid: 1 for iid in instance_ids}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    response = public_events.handle_public_events(
        api_gateway_event(method="GET", path="/v1/calendar/public"),
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
    assert body["items"][0]["service_type"] == "event"
    assert "service_instance_id" in body["items"][0]


def test_handle_public_events_landing_page_filter(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["landing_page"] = landing_page
            captured["service_types"] = service_types
            captured["service_key"] = service_key
            return [_instance_row(status=public_events.InstanceStatus.OPEN)]

        def get_enrollment_counts_for_instances(self, instance_ids: list[Any]) -> dict[Any, int]:
            assert len(instance_ids) == 1
            return {instance_ids[0]: 0}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    slug = "may-2026-the-missing-piece"
    response = public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            path="/v1/calendar/public",
            query_params={"landing_page": slug},
        ),
        "GET",
    )
    assert response["statusCode"] == 200
    assert captured["landing_page"] == slug
    body = json.loads(response["body"])
    assert len(body["events"]) == 1


def test_handle_public_events_invalid_landing_page_ignored(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["landing_page"] = landing_page
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"landing_page": "Invalid.Slug"},
        ),
        "GET",
    )
    assert captured["landing_page"] is None


def test_handle_public_events_service_type_training_course(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["service_types"] = service_types
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_type": "training_course"},
        ),
        "GET",
    )
    assert captured["service_types"] == {ServiceType.TRAINING_COURSE}
    assert captured["service_key"] is None


def test_handle_public_events_invalid_service_type_defaults(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["service_types"] = service_types
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_type": "consultation"},
        ),
        "GET",
    )
    assert captured["service_types"] is None
    assert captured["service_key"] is None


def test_handle_public_events_service_key_passthrough(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_key": "my-best-auntie"},
        ),
        "GET",
    )
    assert captured["service_key"] == "my-best-auntie"


def test_handle_public_events_service_key_trims_and_lowercases(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_key": "  My-Best-Auntie  "},
        ),
        "GET",
    )
    assert captured["service_key"] == "my-best-auntie"


def test_handle_public_events_service_key_invalid_ignored(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_key": "Invalid.Slug"},
        ),
        "GET",
    )
    assert captured["service_key"] is None


def test_handle_public_events_service_key_too_long_ignored(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}
    long_slug = "a" * 81

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_key": long_slug},
        ),
        "GET",
    )
    assert captured["service_key"] is None


def test_handle_public_events_service_key_blank_ignored(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_key": ""},
        ),
        "GET",
    )
    assert captured["service_key"] is None

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_key": "   "},
        ),
        "GET",
    )
    assert captured["service_key"] is None


def test_handle_public_events_service_key_unknown_returns_empty(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            assert service_key == "unknown-service"
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    response = public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={"service_key": "unknown-service"},
        ),
        "GET",
    )
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body == {"events": [], "items": []}


def test_handle_public_events_combined_filters(
    monkeypatch: Any, api_gateway_event: Any
) -> None:
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_public_offerings(
            self,
            *,
            limit: int,
            now: datetime,
            service_types: Any,
            landing_page: str | None,
            service_key: str | None,
        ) -> list[Any]:
            captured["service_types"] = service_types
            captured["landing_page"] = landing_page
            captured["service_key"] = service_key
            return []

        def get_enrollment_counts_for_instances(self, _instance_ids: list[Any]) -> dict[Any, int]:
            return {}

    monkeypatch.setattr(public_events, "Session", _SessionCtx)
    monkeypatch.setattr(public_events, "get_engine", lambda: object())
    monkeypatch.setattr(public_events, "ServiceInstanceRepository", _FakeRepository)

    public_events.handle_public_events(
        api_gateway_event(
            method="GET",
            query_params={
                "service_key": "my-best-auntie",
                "service_type": "training_course",
                "landing_page": "foo-bar",
            },
        ),
        "GET",
    )
    assert captured["service_key"] == "my-best-auntie"
    assert captured["service_types"] == {ServiceType.TRAINING_COURSE}
    assert captured["landing_page"] == "foo-bar"
