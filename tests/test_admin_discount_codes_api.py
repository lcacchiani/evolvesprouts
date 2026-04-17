from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.api import admin_discount_codes
from app.api.admin_services_payloads import (
    REFERRAL_DEFAULT_CURRENCY,
    REFERRAL_DEFAULT_DISCOUNT_VALUE,
    ensure_discount_validity_window,
    parse_create_discount_code_payload,
    parse_update_discount_code_payload,
)
from app.db.models.enums import DiscountType
from app.exceptions import ValidationError


def test_list_discount_codes_returns_repository_total_count(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    row = SimpleNamespace(id=uuid4())
    captured: dict[str, Any] = {}

    class _FakeSession:
        pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeDiscountCodeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def list_codes(self, **kwargs: Any) -> list[Any]:
            captured["list_kwargs"] = kwargs
            return [row, row]

        def count_codes(self, **kwargs: Any) -> int:
            captured["count_kwargs"] = kwargs
            return 17

    monkeypatch.setattr(
        admin_discount_codes,
        "parse_discount_code_filters",
        lambda _event: {
            "limit": 1,
            "active": None,
            "service_id": None,
            "instance_id": None,
            "scope": None,
            "search": None,
            "cursor_created_at": None,
            "cursor_id": None,
        },
    )
    monkeypatch.setattr(admin_discount_codes, "Session", _SessionCtx)
    monkeypatch.setattr(admin_discount_codes, "get_engine", lambda: object())
    monkeypatch.setattr(
        admin_discount_codes,
        "DiscountCodeRepository",
        _FakeDiscountCodeRepository,
    )
    monkeypatch.setattr(
        admin_discount_codes,
        "serialize_discount_code",
        lambda _item: {"id": "code-1"},
    )
    monkeypatch.setattr(
        admin_discount_codes,
        "encode_discount_code_cursor",
        lambda _item: "next-cursor",
    )

    response = admin_discount_codes._list_discount_codes(
        api_gateway_event(method="GET", path="/v1/admin/discount-codes")
    )

    body = json.loads(response["body"])
    assert body["total_count"] == 17
    assert captured["list_kwargs"]["limit"] == 2
    assert captured["list_kwargs"]["scope"] is None
    assert captured["count_kwargs"]["search"] is None
    assert captured["count_kwargs"]["scope"] is None


def test_ensure_discount_validity_window_rejects_inverted_range() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ensure_discount_validity_window(
            datetime(2026, 2, 1, tzinfo=UTC),
            datetime(2026, 1, 1, tzinfo=UTC),
        )
    assert exc_info.value.field == "valid_until"


def test_is_discount_code_unique_violation_matches_constraint_name() -> None:
    class _FakeDiag:
        constraint_name = "discount_codes_code_unique_idx"

    class _FakeOrig:
        diag = _FakeDiag()

    exc = IntegrityError("stmt", {}, _FakeOrig())
    assert admin_discount_codes._is_discount_code_unique_violation(exc) is True


def test_is_discount_code_unique_violation_false_for_other_constraint() -> None:
    class _FakeDiag:
        constraint_name = "other_idx"

    class _FakeOrig:
        diag = _FakeDiag()

    exc = IntegrityError("stmt", {}, _FakeOrig())
    assert admin_discount_codes._is_discount_code_unique_violation(exc) is False


def test_parse_create_discount_code_referral_coerces_value_and_currency() -> None:
    payload = parse_create_discount_code_payload(
        {
            "code": "REF1",
            "discount_type": "referral",
            "discount_value": "99",
            "currency": "USD",
        }
    )
    assert payload["discount_type"] == DiscountType.REFERRAL
    assert payload["discount_value"] == REFERRAL_DEFAULT_DISCOUNT_VALUE
    assert payload["currency"] == REFERRAL_DEFAULT_CURRENCY


def test_parse_create_discount_code_referral_accepts_missing_currency() -> None:
    payload = parse_create_discount_code_payload(
        {
            "code": "REF2",
            "discount_type": "referral",
            "discount_value": "0",
        }
    )
    assert payload["currency"] == REFERRAL_DEFAULT_CURRENCY


def test_parse_update_discount_code_referral_type_coerces() -> None:
    payload = parse_update_discount_code_payload(
        {"discount_type": "referral", "discount_value": "50"}
    )
    assert payload["discount_type"] == DiscountType.REFERRAL
    assert payload["discount_value"] == REFERRAL_DEFAULT_DISCOUNT_VALUE
    assert payload["currency"] == REFERRAL_DEFAULT_CURRENCY


def test_update_discount_code_clamps_partial_payload_for_existing_referral(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    code_id = uuid4()
    row = SimpleNamespace(
        id=code_id,
        description=None,
        discount_type=DiscountType.REFERRAL,
        discount_value=Decimal("0"),
        currency="HKD",
        valid_from=None,
        valid_until=None,
        service_id=None,
        instance_id=None,
        max_uses=None,
        active=True,
    )

    class _FakeSession:
        def commit(self) -> None:
            return None

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeRepo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_id(self, _id: Any) -> Any:
            return row

        def update(self, entity: Any) -> Any:
            return entity

    monkeypatch.setattr(admin_discount_codes, "Session", _SessionCtx)
    monkeypatch.setattr(admin_discount_codes, "get_engine", lambda: object())
    monkeypatch.setattr(admin_discount_codes, "parse_body", lambda _e: {})
    monkeypatch.setattr(
        admin_discount_codes,
        "parse_update_discount_code_payload",
        lambda _body: {"discount_value": Decimal("25")},
    )
    monkeypatch.setattr(admin_discount_codes, "set_audit_context", lambda *_a, **_k: None)
    monkeypatch.setattr(admin_discount_codes, "ensure_discount_code_scope", lambda *_a, **_k: None)
    monkeypatch.setattr(admin_discount_codes, "DiscountCodeRepository", _FakeRepo)
    monkeypatch.setattr(
        admin_discount_codes,
        "serialize_discount_code",
        lambda _c: {"id": str(code_id)},
    )

    admin_discount_codes._update_discount_code(
        api_gateway_event(method="PUT", path=f"/v1/admin/discount-codes/{code_id}"),
        code_id=code_id,
        actor_sub="sub-1",
    )

    assert row.discount_value == REFERRAL_DEFAULT_DISCOUNT_VALUE
    assert row.currency == REFERRAL_DEFAULT_CURRENCY
