from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from app.api import public_discount_validate
from app.db.models.enums import DiscountType


def test_public_discount_validate_rejects_non_post(
    api_gateway_event: Any,
) -> None:
    event = api_gateway_event(method="GET", path="/v1/discounts/validate")

    response = public_discount_validate.handle_public_discount_validate(
        event, "GET"
    )

    assert response["statusCode"] == 405


def test_public_discount_validate_returns_rule_for_percentage_code(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="SAVE10",
        description="Ten percent",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("10.00"),
        currency="HKD",
        active=True,
        valid_from=None,
        valid_until=None,
        max_uses=None,
        current_uses=0,
    )

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

        def get_by_code(self, code: str) -> Any:
            assert code == "save10"
            return row

    monkeypatch.setattr(public_discount_validate, "Session", _SessionCtx)
    monkeypatch.setattr(public_discount_validate, "get_engine", lambda: object())
    monkeypatch.setattr(
        public_discount_validate,
        "DiscountCodeRepository",
        _FakeRepository,
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "save10"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["valid"] is True
    assert body["is_valid"] is True
    assert body["data"] == body["discount"]
    assert body["data"] == {
        "code": "SAVE10",
        "name": "Ten percent",
        "amount": 10.0,
        "is_percentage": True,
        "currency_code": None,
        "currency_symbol": None,
    }


def test_public_discount_validate_returns_404_when_before_valid_from(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="FUTURE",
        description=None,
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("5.00"),
        currency=None,
        active=True,
        valid_from=datetime(2026, 6, 1, tzinfo=UTC),
        valid_until=None,
        max_uses=None,
        current_uses=0,
    )

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

        def get_by_code(self, _code: str) -> Any:
            return row

    monkeypatch.setattr(public_discount_validate, "Session", _SessionCtx)
    monkeypatch.setattr(public_discount_validate, "get_engine", lambda: object())
    monkeypatch.setattr(
        public_discount_validate,
        "DiscountCodeRepository",
        _FakeRepository,
    )
    monkeypatch.setattr(
        public_discount_validate,
        "datetime",
        SimpleNamespace(now=lambda tz=None: datetime(2026, 1, 1, tzinfo=UTC)),
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "FUTURE"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_returns_404_when_missing(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
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

        def get_by_code(self, _code: str) -> Any:
            return None

    monkeypatch.setattr(public_discount_validate, "Session", _SessionCtx)
    monkeypatch.setattr(public_discount_validate, "get_engine", lambda: object())
    monkeypatch.setattr(
        public_discount_validate,
        "DiscountCodeRepository",
        _FakeRepository,
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "NONE"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404
