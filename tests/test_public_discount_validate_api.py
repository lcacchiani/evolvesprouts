from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

from app.api import public_discount_validate
from app.db.models.enums import DiscountType

_DEFAULT_VALIDATE_SERVICE_KEY = "my-best-auntie-training-course"
_DEFAULT_VALIDATE_INSTANCE_SLUG = "mba-apr-26"


def _discount_validate_body(
    code: str,
    *,
    service_key: str = _DEFAULT_VALIDATE_SERVICE_KEY,
    service_instance_slug: str = _DEFAULT_VALIDATE_INSTANCE_SLUG,
    include_service_instance_slug: bool = True,
    **extra: object,
) -> str:
    payload: dict[str, object] = {
        "code": code,
        "service_key": service_key,
    }
    if include_service_instance_slug:
        payload["service_instance_slug"] = service_instance_slug
    payload.update(extra)
    return json.dumps(payload)


def _patch_generic_instance_resolution(
    monkeypatch: Any,
    *,
    service_key: str = _DEFAULT_VALIDATE_SERVICE_KEY,
    instance_slug: str = _DEFAULT_VALIDATE_INSTANCE_SLUG,
    instance_id: UUID | None = None,
    service_id: UUID | None = None,
) -> tuple[UUID, UUID]:
    """Stub ``ServiceInstanceRepository.get_with_service_by_slug`` for tests that only mock discounts."""
    inst_id = instance_id or uuid4()
    svc_id = service_id or uuid4()
    resolved = SimpleNamespace(
        id=inst_id,
        service=SimpleNamespace(id=svc_id, service_key=service_key),
    )

    class _FakeServiceInstanceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def get_with_service_by_slug(self, slug: str) -> Any:
            if slug.strip().lower() != instance_slug.strip().lower():
                return None
            return resolved

    monkeypatch.setattr(
        public_discount_validate,
        "ServiceInstanceRepository",
        _FakeServiceInstanceRepository,
    )
    return inst_id, svc_id


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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("save10"),
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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("FUTURE"),
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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("save50"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["data"]["is_percentage"] is False
    assert body["data"]["amount"] == 50.0
    assert body["data"]["currency_code"] == "HKD"
    assert body["data"]["currency_symbol"] == "HK$"


def test_public_discount_validate_returns_404_for_referral_type_when_active(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="REFTRACK",
        description=None,
        discount_type=DiscountType.REFERRAL,
        discount_value=Decimal("0.00"),
        currency="HKD",
        active=True,
        valid_from=None,
        valid_until=None,
        max_uses=None,
        current_uses=0,
        service_id=None,
        instance_id=None,
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
            assert code.strip().lower() == "reftrack"
            return row

    monkeypatch.setattr(public_discount_validate, "Session", _SessionCtx)
    monkeypatch.setattr(public_discount_validate, "get_engine", lambda: object())
    monkeypatch.setattr(
        public_discount_validate,
        "DiscountCodeRepository",
        _FakeRepository,
    )
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("REFTRACK"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert body["error"] == "Discount code not found or inactive"


def test_public_discount_validate_returns_404_for_referral_type_when_inactive(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(
        id=uuid4(),
        code="REFOFF",
        description=None,
        discount_type=DiscountType.REFERRAL,
        discount_value=Decimal("0.00"),
        currency="HKD",
        active=False,
        valid_from=None,
        valid_until=None,
        max_uses=None,
        current_uses=0,
        service_id=None,
        instance_id=None,
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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("REFOFF"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("OFF"),
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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("OLD"),
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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("US"),
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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("EDGE"),
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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("FULL"),
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
    _patch_generic_instance_resolution(monkeypatch)

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("NONE"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


_MISSING = object()


def _patch_discount_validate_repositories(
    monkeypatch: Any,
    *,
    discount_row: SimpleNamespace,
    slug_to_service_id: dict[str, UUID] | None = None,
    slug_to_instance_id: dict[str, UUID] | object = _MISSING,
) -> None:
    """Patch Session + repositories for public_discount_validate unit tests."""

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeDiscountRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_code(self, code: str) -> Any:
            assert code.strip().lower() == discount_row.code.strip().lower()
            return discount_row

    svc_map = dict(slug_to_service_id or {})
    if slug_to_instance_id is _MISSING:
        inst_map: dict[str, UUID] = {"mba-apr-26": uuid4()}
    else:
        inst_map = dict(slug_to_instance_id)  # type: ignore[arg-type]

    class _FakeServiceInstanceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def get_with_service_by_slug(self, slug: str) -> Any:
            key = slug.strip().lower()
            inst_id = inst_map.get(key)
            if inst_id is None:
                return None
            if "my-best-auntie-training-course" in svc_map:
                svc_id = svc_map["my-best-auntie-training-course"]
                svc_key = "my-best-auntie-training-course"
            elif svc_map:
                svc_key, svc_id = next(iter(svc_map.items()))
            else:
                svc_id = uuid4()
                svc_key = "my-best-auntie-training-course"
            return SimpleNamespace(
                id=inst_id,
                service=SimpleNamespace(id=svc_id, service_key=svc_key),
            )

    monkeypatch.setattr(public_discount_validate, "Session", _SessionCtx)
    monkeypatch.setattr(public_discount_validate, "get_engine", lambda: object())
    monkeypatch.setattr(
        public_discount_validate,
        "DiscountCodeRepository",
        _FakeDiscountRepository,
    )
    monkeypatch.setattr(
        public_discount_validate,
        "ServiceInstanceRepository",
        _FakeServiceInstanceRepository,
    )


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
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": uuid4()},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("ANY"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_returns_404_when_service_key_does_not_match_instance(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    """``service_key`` must match the parent service of the resolved instance."""
    row = _usable_row(code="ANY")
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": uuid4()},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("ANY", service_key="not-a-real-slug"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert body.get("rejection_reason") == "service_key_instance_mismatch"


def test_public_discount_validate_service_scoped_match(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    row = _usable_row(code="MBA", service_id=svc, instance_id=None)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": svc},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("MBA"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_service_scoped_mismatch_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = _usable_row(code="MBA", service_id=uuid4(), instance_id=None)
    other = uuid4()
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": other},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("MBA"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_unknown_service_key_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = _usable_row(code="MBA", service_id=uuid4(), instance_id=None)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("MBA"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_instance_scoped_missing_instance_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    inst = uuid4()
    row = _usable_row(code="INST", service_id=svc, instance_id=inst)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": svc},
        slug_to_instance_id={"other-cohort": inst},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("INST"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_instance_scoped_match_returns_200(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    inst = uuid4()
    row = _usable_row(code="INST", service_id=svc, instance_id=inst)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": svc},
        slug_to_instance_id={"mba-apr-26": inst},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("INST", service_instance_slug="mba-apr-26"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_instance_scoped_wrong_service_key_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    """Instance resolution is always checked against ``service_key``."""
    svc = uuid4()
    inst = uuid4()
    row = _usable_row(code="INST", service_id=svc, instance_id=inst)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": svc},
        slug_to_instance_id={"mba-apr-26": inst},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body(
            "INST",
            service_key="not-a-real-slug",
            service_instance_slug="mba-apr-26",
        ),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert body.get("rejection_reason") == "service_key_instance_mismatch"


def test_public_discount_validate_instance_scoped_mismatch_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    inst = uuid4()
    other_inst = uuid4()
    row = _usable_row(code="INST", service_id=svc, instance_id=inst)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": svc},
        slug_to_instance_id={"mba-other": other_inst},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("INST", service_instance_slug="mba-other"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_instance_scoped_unknown_instance_slug_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    inst = uuid4()
    row = _usable_row(code="INST", service_id=svc, instance_id=inst)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": svc},
        slug_to_instance_id={},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("INST", service_instance_slug="no-such-cohort"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_service_id_body_ignored_when_service_key_matches(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    """``service_id`` is ignored; ``service_key`` alone must satisfy service scope."""
    svc = uuid4()
    row = _usable_row(code="BYID", service_id=svc, instance_id=None)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-svc": svc},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("BYID", service_key="my-svc"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_service_scoped_requires_matching_identity_pair(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    """Service-scoped codes validate once (service_key, service_instance_slug) resolves."""
    svc = uuid4()
    row = _usable_row(code="OPEN", service_id=svc, instance_id=None)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-open": svc},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("OPEN", service_key="my-open"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_instance_slug_mixed_case_resolves(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    inst = uuid4()
    row = _usable_row(code="INST", service_id=svc, instance_id=inst)
    _patch_discount_validate_repositories(
        monkeypatch,
        discount_row=row,
        slug_to_service_id={"my-best-auntie-training-course": svc},
        slug_to_instance_id={"mba-apr-26": inst},
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body("INST", service_instance_slug="MBA-Apr-26"),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def _patch_discount_validate_service_key_only(
    monkeypatch: Any,
    *,
    discount_row: SimpleNamespace,
    resolved_service_id: UUID,
    resolved_service_key: str,
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

    class _FakeDiscountRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_code(self, code: str) -> Any:
            assert code.strip().lower() == discount_row.code.strip().lower()
            return discount_row

    expected_key = resolved_service_key.strip().lower()

    class _FakeServiceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_service_key(self, key: str) -> Any:
            if key.strip().lower() == expected_key:
                return SimpleNamespace(id=resolved_service_id, service_key=key)
            return None

    class _FakeServiceInstanceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def get_with_service_by_slug(self, slug: str) -> Any:
            raise AssertionError(
                f"unexpected slug lookup in service-key-only mode: {slug!r}",
            )

    monkeypatch.setattr(public_discount_validate, "Session", _SessionCtx)
    monkeypatch.setattr(public_discount_validate, "get_engine", lambda: object())
    monkeypatch.setattr(
        public_discount_validate,
        "DiscountCodeRepository",
        _FakeDiscountRepository,
    )
    monkeypatch.setattr(
        public_discount_validate,
        "ServiceRepository",
        _FakeServiceRepository,
    )
    monkeypatch.setattr(
        public_discount_validate,
        "ServiceInstanceRepository",
        _FakeServiceInstanceRepository,
    )


def test_public_discount_validate_service_key_only_service_scoped_match(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    row = _usable_row(code="ESS", service_id=svc, instance_id=None)
    _patch_discount_validate_service_key_only(
        monkeypatch,
        discount_row=row,
        resolved_service_id=svc,
        resolved_service_key="family-consultation-essentials",
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body(
            "ESS",
            service_key="family-consultation-essentials",
            include_service_instance_slug=False,
        ),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 200


def test_public_discount_validate_service_key_only_instance_scoped_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    inst = uuid4()
    row = _usable_row(code="INSTONLY", service_id=svc, instance_id=inst)
    _patch_discount_validate_service_key_only(
        monkeypatch,
        discount_row=row,
        resolved_service_id=svc,
        resolved_service_key="family-consultation-essentials",
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body(
            "INSTONLY",
            service_key="family-consultation-essentials",
            include_service_instance_slug=False,
        ),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404


def test_public_discount_validate_service_key_only_unknown_service_returns_404(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    svc = uuid4()
    row = _usable_row(code="ESS", service_id=svc, instance_id=None)
    _patch_discount_validate_service_key_only(
        monkeypatch,
        discount_row=row,
        resolved_service_id=svc,
        resolved_service_key="family-consultation-essentials",
    )

    event = api_gateway_event(
        method="POST",
        path="/v1/discounts/validate",
        body=_discount_validate_body(
            "ESS",
            service_key="no-such-consultation-tier",
            include_service_instance_slug=False,
        ),
    )
    response = public_discount_validate.handle_public_discount_validate(event, "POST")
    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert body.get("rejection_reason") == "unknown_service_key"
