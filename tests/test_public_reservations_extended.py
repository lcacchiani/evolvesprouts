"""Tests for native reservation persistence and post-success hooks."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api.public_reservations import (
    _handle_public_reservation,
    _validate_discount_code_redemption_scope,
    _validate_reservation_payload,
)
from app.db.models.enums import DiscountType


def _reservation_body(**overrides: object) -> dict[str, Any]:
    base: dict[str, Any] = {
        "attendeeName": "Test User",
        "attendeeEmail": "u@example.com",
        "attendeePhone": "91234567",
        "attendeeCountry": "HK",
        "serviceTier": "3-5 years",
        "paymentMethod": "bank_transfer",
        "totalAmount": 100,
        "courseLabel": "Course",
        "agreedToTermsAndConditions": True,
        "locale": "en",
    }
    base.update(overrides)
    return base


def test_validate_reservation_payload_normalizes_mixed_case_service_instance_slug() -> None:
    body = _reservation_body(
        serviceInstanceSlug="My-Cohort-Slug",
    )
    out = _validate_reservation_payload(body)
    assert out["service_instance_slug"] == "my-cohort-slug"


def _post_event(api_gateway_event: Any, body: dict[str, Any]) -> dict[str, Any]:
    return api_gateway_event(
        method="POST",
        path="/v1/reservations",
        body=json.dumps(body),
        headers={"X-Turnstile-Token": "tok"},
    )


def _patch_public_reservation_db_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    """Minimal fakes so reservation persistence does not require real DB helpers."""
    monkeypatch.setattr(
        "app.api.public_reservations._validate_payment_confirmation",
        lambda *_a, **_k: None,
    )

    class _FakeDiscountRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_by_code(self, _code: str) -> None:
            return None

        def validate_and_increment(self, _code_id: object) -> bool:
            return True

        def decrement_uses(self, _code_id: object) -> bool:
            return True

    class _FakeInstanceRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_id_by_slug(self, _slug: str) -> None:
            return None

    class _FakeEnrollmentRepo:
        def __init__(self, _session: object) -> None:
            pass

        def contact_has_enrollment_for_instance(self, **_kwargs: object) -> bool:
            return False

        def create_enrollment(self, _enrollment: object) -> object:
            return _enrollment

    monkeypatch.setattr(
        "app.api.public_reservations.DiscountCodeRepository",
        _FakeDiscountRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.ServiceInstanceRepository",
        _FakeInstanceRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.EnrollmentRepository",
        _FakeEnrollmentRepo,
    )


def test_handle_public_reservation_returns_409_when_instance_capacity_full(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    _patch_public_reservation_db_helpers(monkeypatch)

    contact_id = uuid4()
    instance_uuid = uuid4()

    class _FakeDiscountRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_by_code(self, _code: str) -> None:
            return None

    class _FakeInstanceRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_id_by_slug(self, slug: str) -> object | None:
            return instance_uuid if slug == "full-cohort" else None

    class _FakeEnrollmentRepo:
        def __init__(self, _session: object) -> None:
            pass

        def contact_has_enrollment_for_instance(self, **_kwargs: object) -> bool:
            return False

        def try_create_enrollment_with_capacity_guard(
            self, _enrollment: object
        ) -> tuple[None, str]:
            return None, "capacity_full"

    monkeypatch.setattr(
        "app.api.public_reservations.DiscountCodeRepository",
        _FakeDiscountRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.ServiceInstanceRepository",
        _FakeInstanceRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.EnrollmentRepository",
        _FakeEnrollmentRepo,
    )

    class _FakeContactRepo:
        def __init__(self, _session: object) -> None:
            pass

        def upsert_by_email(self, _email: str, **kwargs: object) -> tuple[object, bool]:
            c = MagicMock()
            c.id = contact_id
            c.phone_region = None
            c.phone_national_number = None
            return c, True

        def update(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeLeadRepo:
        def __init__(self, _session: object) -> None:
            pass

        def create_with_event(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeSalesLead:
        def __init__(self, **kwargs: object) -> None:
            pass

    monkeypatch.setattr("app.api.public_reservations.SalesLead", _FakeSalesLead)

    class _FakeSession:
        def commit(self) -> None:
            return None

    class _FakeSessionCM:
        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_a: object) -> bool:
            return False

    monkeypatch.setattr(
        "app.api.public_reservations.ContactRepository",
        _FakeContactRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.SalesLeadRepository",
        _FakeLeadRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.Session",
        lambda _e: _FakeSessionCM(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.get_engine",
        lambda: object(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.service_id_for_instance",
        lambda _session, _iid: uuid4(),
    )

    body = _reservation_body(serviceInstanceSlug="full-cohort")
    event = _post_event(api_gateway_event, body)
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 409
    body_json = json.loads(resp["body"])
    assert body_json.get("field") == "serviceInstanceSlug"


def test_handle_public_reservation_accepts_free_payment_zero_total(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    _patch_public_reservation_db_helpers(monkeypatch)
    hooks = MagicMock()
    monkeypatch.setattr(
        "app.api.public_reservations._run_reservation_post_success_hooks",
        hooks,
    )

    contact_id = uuid4()

    class _FakeContactRepo:
        def __init__(self, _session: object) -> None:
            pass

        def upsert_by_email(self, _email: str, **kwargs: object) -> tuple[object, bool]:
            c = MagicMock()
            c.id = contact_id
            c.phone_region = None
            c.phone_national_number = None
            return c, True

        def update(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeLeadRepo:
        def __init__(self, _session: object) -> None:
            pass

        def create_with_event(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeSalesLead:
        def __init__(self, **kwargs: object) -> None:
            pass

    monkeypatch.setattr(
        "app.api.public_reservations.SalesLead",
        _FakeSalesLead,
    )

    class _FakeSession:
        def commit(self) -> None:
            return None

    class _FakeSessionCM:
        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_a: object) -> bool:
            return False

    monkeypatch.setattr(
        "app.api.public_reservations.ContactRepository",
        _FakeContactRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.SalesLeadRepository",
        _FakeLeadRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.Session",
        lambda _e: _FakeSessionCM(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.get_engine",
        lambda: object(),
    )

    body = _reservation_body(
        paymentMethod="free",
        totalAmount=0,
        reservationPendingUntilPaymentConfirmed=False,
    )
    event = _post_event(api_gateway_event, body)
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 202
    hooks.assert_called_once()
    payload = hooks.call_args[0][0]
    assert payload["payment_method"] == "free"


def test_handle_public_reservation_rejects_free_with_nonzero_total(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    body = _reservation_body(
        paymentMethod="free",
        totalAmount=500,
        reservationPendingUntilPaymentConfirmed=False,
    )
    event = _post_event(api_gateway_event, body)
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 400


def test_handle_public_reservation_rejects_zero_total_without_free_method(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    body = _reservation_body(
        paymentMethod="bank_transfer",
        totalAmount=0,
        reservationPendingUntilPaymentConfirmed=False,
    )
    event = _post_event(api_gateway_event, body)
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 400


def test_handle_public_reservation_forces_pending_false_for_free_even_if_client_sends_true(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    _patch_public_reservation_db_helpers(monkeypatch)
    hooks = MagicMock()
    monkeypatch.setattr(
        "app.api.public_reservations._run_reservation_post_success_hooks",
        hooks,
    )

    contact_id = uuid4()

    class _FakeContactRepo:
        def __init__(self, _session: object) -> None:
            pass

        def upsert_by_email(self, _email: str, **kwargs: object) -> tuple[object, bool]:
            c = MagicMock()
            c.id = contact_id
            c.phone_region = None
            c.phone_national_number = None
            return c, True

        def update(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeLeadRepo:
        def __init__(self, _session: object) -> None:
            pass

        def create_with_event(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeSalesLead:
        def __init__(self, **kwargs: object) -> None:
            pass

    monkeypatch.setattr(
        "app.api.public_reservations.SalesLead",
        _FakeSalesLead,
    )

    class _FakeSession:
        def commit(self) -> None:
            return None

    class _FakeSessionCM:
        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_a: object) -> bool:
            return False

    monkeypatch.setattr(
        "app.api.public_reservations.ContactRepository",
        _FakeContactRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.SalesLeadRepository",
        _FakeLeadRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.Session",
        lambda _e: _FakeSessionCM(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.get_engine",
        lambda: object(),
    )

    body = _reservation_body(
        paymentMethod="free",
        totalAmount=0,
        reservationPendingUntilPaymentConfirmed=True,
    )
    event = _post_event(api_gateway_event, body)
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 202
    payload = hooks.call_args[0][0]
    assert payload["reservation_pending_until_payment_confirmed"] is False


def test_handle_public_reservation_runs_hooks_after_persist(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    _patch_public_reservation_db_helpers(monkeypatch)
    hooks = MagicMock()
    monkeypatch.setattr(
        "app.api.public_reservations._run_reservation_post_success_hooks",
        hooks,
    )

    contact_id = uuid4()

    class _FakeContactRepo:
        def __init__(self, _session: object) -> None:
            pass

        def upsert_by_email(self, _email: str, **kwargs: object) -> tuple[object, bool]:
            c = MagicMock()
            c.id = contact_id
            c.phone_region = None
            c.phone_national_number = None
            return c, True

        def update(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeLeadRepo:
        def __init__(self, _session: object) -> None:
            pass

        def create_with_event(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeSalesLead:
        def __init__(self, **kwargs: object) -> None:
            pass

    monkeypatch.setattr(
        "app.api.public_reservations.SalesLead",
        _FakeSalesLead,
    )

    class _FakeSession:
        def commit(self) -> None:
            return None

    class _FakeSessionCM:
        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_a: object) -> bool:
            return False

    monkeypatch.setattr(
        "app.api.public_reservations.ContactRepository",
        _FakeContactRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.SalesLeadRepository",
        _FakeLeadRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.Session",
        lambda _e: _FakeSessionCM(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.get_engine",
        lambda: object(),
    )

    event = _post_event(api_gateway_event, _reservation_body())
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 202
    hooks.assert_called_once()
    payload = hooks.call_args[0][0]
    assert payload["attendee_email"] == "u@example.com"
    assert payload["payment_method"] == "bank_transfer"


def test_handle_public_reservation_accepts_missing_service_tier(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Event-style bookings omit serviceTier; persistence and hooks still succeed."""
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    _patch_public_reservation_db_helpers(monkeypatch)
    hooks = MagicMock()
    monkeypatch.setattr(
        "app.api.public_reservations._run_reservation_post_success_hooks",
        hooks,
    )

    contact_id = uuid4()

    class _FakeContactRepo:
        def __init__(self, _session: object) -> None:
            pass

        def upsert_by_email(self, _email: str, **kwargs: object) -> tuple[object, bool]:
            c = MagicMock()
            c.id = contact_id
            c.phone_region = None
            c.phone_national_number = None
            return c, True

        def update(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeLeadRepo:
        def __init__(self, _session: object) -> None:
            pass

        def create_with_event(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeSalesLead:
        def __init__(self, **kwargs: object) -> None:
            pass

    monkeypatch.setattr(
        "app.api.public_reservations.SalesLead",
        _FakeSalesLead,
    )

    class _FakeSession:
        def commit(self) -> None:
            return None

    class _FakeSessionCM:
        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_a: object) -> bool:
            return False

    monkeypatch.setattr(
        "app.api.public_reservations.ContactRepository",
        _FakeContactRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.SalesLeadRepository",
        _FakeLeadRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.Session",
        lambda _e: _FakeSessionCM(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.get_engine",
        lambda: object(),
    )

    body = _reservation_body()
    del body["serviceTier"]
    event = _post_event(api_gateway_event, body)
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 202
    hooks.assert_called_once()
    payload = hooks.call_args[0][0]
    assert payload.get("service_tier") is None


def test_handle_public_reservation_validation_rejects_missing_terms(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    body = _reservation_body()
    del body["agreedToTermsAndConditions"]
    event = _post_event(api_gateway_event, body)
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 400


def test_discount_redemption_rejects_service_scope_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.exceptions import ValidationError

    svc = uuid4()
    other = uuid4()

    class _FakeRow:
        service_id = svc
        instance_id = None
        discount_type = DiscountType.PERCENTAGE
        active = True
        valid_from = None
        valid_until = None
        max_uses = None
        current_uses = 0

    class _FakeDiscountRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_by_code(self, _code: str) -> object:
            return _FakeRow()

    class _FakeServiceRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_by_slug(self, slug: str) -> object | None:
            if slug.strip().lower() == "my-best-auntie":
                return type("S", (), {"id": other})()
            return None

    monkeypatch.setattr(
        "app.api.public_reservations.DiscountCodeRepository",
        _FakeDiscountRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.ServiceRepository",
        _FakeServiceRepo,
    )

    class _FakeInstanceRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_id_by_slug(self, _slug: str) -> object | None:
            return None

    monkeypatch.setattr(
        "app.api.public_reservations.ServiceInstanceRepository",
        _FakeInstanceRepo,
    )

    payload = {
        "discount_code": "SAVE",
        "service_key": "my-best-auntie",
        "course_slug": "my-best-auntie",
    }
    with pytest.raises(ValidationError):
        _validate_discount_code_redemption_scope(object(), payload)


def test_discount_redemption_requires_instance_slug_for_instance_scoped_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.exceptions import ValidationError

    inst = uuid4()

    class _FakeRow:
        service_id = uuid4()
        instance_id = inst
        discount_type = DiscountType.PERCENTAGE
        active = True
        valid_from = None
        valid_until = None
        max_uses = None
        current_uses = 0

    class _FakeDiscountRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_by_code(self, _code: str) -> object:
            return _FakeRow()

    class _FakeServiceRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_by_slug(self, slug: str) -> object | None:
            return None

    class _FakeInstanceRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_id_by_slug(self, _slug: str) -> object | None:
            return None

    monkeypatch.setattr(
        "app.api.public_reservations.DiscountCodeRepository",
        _FakeDiscountRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.ServiceRepository",
        _FakeServiceRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.ServiceInstanceRepository",
        _FakeInstanceRepo,
    )

    payload = {"discount_code": "SAVE", "service_key": "cohort-1"}
    with pytest.raises(ValidationError) as excinfo:
        _validate_discount_code_redemption_scope(object(), payload)
    assert getattr(excinfo.value, "field", None) == "serviceInstanceSlug"


def test_discount_redemption_rejects_referral_type(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.exceptions import ValidationError

    class _FakeRow:
        service_id = None
        instance_id = None
        discount_type = DiscountType.REFERRAL
        active = True
        valid_from = None
        valid_until = None
        max_uses = None
        current_uses = 0

    class _FakeDiscountRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_by_code(self, _code: str) -> object:
            return _FakeRow()

    monkeypatch.setattr(
        "app.api.public_reservations.DiscountCodeRepository",
        _FakeDiscountRepo,
    )

    with pytest.raises(ValidationError) as excinfo:
        _validate_discount_code_redemption_scope(object(), {"discount_code": "REF"})
    assert getattr(excinfo.value, "field", None) == "discountCode"


def test_handle_public_reservation_writes_discount_metadata_and_creates_enrollment(
    api_gateway_event: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.api.public_reservations.verify_turnstile_token",
        lambda *_a, **_k: True,
    )
    monkeypatch.setattr(
        "app.api.public_reservations._validate_payment_confirmation",
        lambda *_a, **_k: None,
    )
    hooks = MagicMock()
    monkeypatch.setattr(
        "app.api.public_reservations._run_reservation_post_success_hooks",
        hooks,
    )

    contact_id = uuid4()
    instance_uuid = uuid4()
    discount_uuid = uuid4()

    class _FakeDcRow:
        id = discount_uuid
        service_id = None
        instance_id = None
        discount_type = DiscountType.PERCENTAGE
        active = True
        valid_from = None
        valid_until = None
        max_uses = None
        current_uses = 0

    class _FakeDiscountRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_by_code(self, code: str) -> object | None:
            if code.strip().lower() == "spring10":
                return _FakeDcRow()
            return None

        def validate_and_increment(self, code_id: object) -> bool:
            assert code_id == discount_uuid
            return True

        def decrement_uses(self, _code_id: object) -> bool:
            return True

    class _FakeInstanceRepo:
        def __init__(self, _session: object) -> None:
            pass

        def get_id_by_slug(self, slug: str) -> object | None:
            if slug == "cohort-a":
                return instance_uuid
            return None

    created_enrollments: list[object] = []

    class _FakeEnrollmentRepo:
        def __init__(self, _session: object) -> None:
            pass

        def contact_has_enrollment_for_instance(self, **_kwargs: object) -> bool:
            return False

        def try_create_enrollment_with_capacity_guard(
            self, enrollment: object
        ) -> tuple[object | None, str | None]:
            created_enrollments.append(enrollment)
            return enrollment, None

    monkeypatch.setattr(
        "app.api.public_reservations.DiscountCodeRepository",
        _FakeDiscountRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.ServiceInstanceRepository",
        _FakeInstanceRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.EnrollmentRepository",
        _FakeEnrollmentRepo,
    )

    class _FakeContactRepo:
        def __init__(self, _session: object) -> None:
            pass

        def upsert_by_email(self, _email: str, **kwargs: object) -> tuple[object, bool]:
            c = MagicMock()
            c.id = contact_id
            c.phone_region = None
            c.phone_national_number = None
            return c, True

        def update(self, *_a: object, **_k: object) -> None:
            return None

    lead_calls: list[dict[str, object]] = []

    class _FakeLeadRepo:
        def __init__(self, _session: object) -> None:
            pass

        def create_with_event(self, *_a: object, **kwargs: object) -> None:
            lead_calls.append(kwargs)

    class _FakeSalesLead:
        def __init__(self, **kwargs: object) -> None:
            pass

    monkeypatch.setattr(
        "app.api.public_reservations.SalesLead",
        _FakeSalesLead,
    )

    class _FakeSession:
        def commit(self) -> None:
            return None

        def flush(self) -> None:
            return None

        def delete(self, *_a: object, **_k: object) -> None:
            return None

    class _FakeSessionCM:
        def __enter__(self) -> _FakeSession:
            return _FakeSession()

        def __exit__(self, *_a: object) -> bool:
            return False

    monkeypatch.setattr(
        "app.api.public_reservations.ContactRepository",
        _FakeContactRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.SalesLeadRepository",
        _FakeLeadRepo,
    )
    monkeypatch.setattr(
        "app.api.public_reservations.Session",
        lambda _e: _FakeSessionCM(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.get_engine",
        lambda: object(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.service_id_for_instance",
        lambda _session, _iid: uuid4(),
    )
    monkeypatch.setattr(
        "app.api.public_reservations.ensure_discount_code_eligible_for_instance",
        lambda *_a, **_k: None,
    )

    body = _reservation_body(
        discountCode="SPRING10",
        serviceInstanceSlug="cohort-a",
    )
    event = _post_event(api_gateway_event, body)
    resp = _handle_public_reservation(event, "POST")
    assert resp["statusCode"] == 202
    assert len(created_enrollments) == 1
    en = created_enrollments[0]
    assert en.instance_id == instance_uuid
    assert en.contact_id == contact_id
    assert en.discount_code_id == discount_uuid
    assert lead_calls and lead_calls[0].get("metadata")
    meta = lead_calls[0]["metadata"]
    assert isinstance(meta, dict)
    assert meta.get("discount_code") == "SPRING10"
    assert meta.get("discount_code_id") == str(discount_uuid)
