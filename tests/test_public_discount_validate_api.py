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


def test_public_discount_validate_returns_rule_for_absolute_discount(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="SAVE50",
        description="Fifty off",
        discount_type=DiscountType.ABSOLUTE,
        discount_value=Decimal("50.00"),
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
            assert code == "save50"
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
        body=json.dumps({"code": "save50"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["data"]["is_percentage"] is False
    assert body["data"]["amount"] == 50.0
    assert body["data"]["currency_code"] == "HKD"
    assert body["data"]["currency_symbol"] == "HK$"


def test_public_discount_validate_returns_404_when_inactive(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="OFF",
        description=None,
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("10.00"),
        currency=None,
        active=False,
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

        def get_by_code(self, _code: str) -> Any:
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
        body=json.dumps({"code": "OFF"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_returns_404_when_valid_until_passed(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="OLD",
        description=None,
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("5.00"),
        currency=None,
        active=True,
        valid_from=None,
        valid_until=datetime(2026, 1, 1, tzinfo=UTC),
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
        SimpleNamespace(now=lambda tz=None: datetime(2026, 1, 2, tzinfo=UTC)),
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "OLD"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_succeeds_when_now_has_microseconds_but_until_is_second_precision(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    """Inclusive valid_until must not fail when DB stores whole seconds and now has μs."""
    row = SimpleNamespace(
        id=uuid4(),
        code="US",
        description=None,
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("5.00"),
        currency=None,
        active=True,
        valid_from=None,
        valid_until=datetime(2026, 1, 2, 12, 0, 0, tzinfo=UTC),
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
        SimpleNamespace(
            now=lambda tz=None: datetime(2026, 1, 2, 12, 0, 0, 123456, tzinfo=UTC)
        ),
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "US"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_succeeds_on_valid_until_boundary(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="EDGE",
        description=None,
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("5.00"),
        currency=None,
        active=True,
        valid_from=None,
        valid_until=datetime(2026, 1, 2, 12, 0, 0, tzinfo=UTC),
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
        SimpleNamespace(now=lambda tz=None: datetime(2026, 1, 2, 12, 0, 0, tzinfo=UTC)),
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "EDGE"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_returns_404_when_max_uses_exhausted(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="FULL",
        description=None,
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("5.00"),
        currency=None,
        active=True,
        valid_from=None,
        valid_until=None,
        max_uses=1,
        current_uses=1,
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

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "FULL"}),
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


def _usable_row(**overrides: object) -> SimpleNamespace:
    base = dict(
        id=uuid4(),
        code="ANY",
        description=None,
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("5.00"),
        currency=None,
        active=True,
        valid_from=None,
        valid_until=None,
        max_uses=None,
        current_uses=0,
        service_id=None,
        instance_id=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_public_discount_validate_unscoped_code_ignores_service_key(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = _usable_row(code="ANY")

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
    monkeypatch.setenv(
        "PUBLIC_SERVICE_KEY_MAP_JSON",
        '{"my-best-auntie":"00000000-0000-4000-8000-000000000001"}',
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "ANY", "service_key": "my-best-auntie"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_service_scoped_match(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    row = _usable_row(code="MBA", service_id=svc, instance_id=None)

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
    monkeypatch.setenv(
        "PUBLIC_SERVICE_KEY_MAP_JSON",
        json.dumps({"my-best-auntie": str(svc)}),
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "MBA", "service_key": "my-best-auntie"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_service_scoped_mismatch_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = _usable_row(code="MBA", service_id=uuid4(), instance_id=None)

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
    other = uuid4()
    monkeypatch.setenv(
        "PUBLIC_SERVICE_KEY_MAP_JSON",
        json.dumps({"my-best-auntie": str(other)}),
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "MBA", "service_key": "my-best-auntie"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_unknown_service_key_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = _usable_row(code="MBA", service_id=uuid4(), instance_id=None)

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
    monkeypatch.setenv("PUBLIC_SERVICE_KEY_MAP_JSON", "{}")

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "MBA", "service_key": "my-best-auntie"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_instance_scoped_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = _usable_row(code="INST", service_id=uuid4(), instance_id=uuid4())

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
    monkeypatch.setenv(
        "PUBLIC_SERVICE_KEY_MAP_JSON",
        json.dumps({"my-best-auntie": str(row.service_id)}),
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "INST", "service_key": "my-best-auntie"}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_service_id_body_path(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    row = _usable_row(code="BYID", service_id=svc, instance_id=None)

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

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=json.dumps({"code": "BYID", "service_id": str(svc)}),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200
