from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import pytest

from app.api import admin_enrollments
from app.db.models.enums import EnrollmentStatus
from app.exceptions import ValidationError


def _patch_enrollment_discount_scope_ok(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        admin_enrollments,
        "service_id_for_instance",
        lambda _session, _instance_id: uuid4(),
    )
    monkeypatch.setattr(
        admin_enrollments,
        "ensure_discount_code_eligible_for_instance",
        lambda *_a, **_k: None,
    )


def test_create_enrollment_rejects_invalid_or_exhausted_discount_code(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    instance_id = uuid4()
    discount_code_id = uuid4()

    class _FakeSession:
        def commit(self) -> None:
            raise AssertionError("commit should not run when discount code is invalid")

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

        def validate_and_increment(self, _code_id: Any) -> bool:
            return False

    class _FakeEnrollmentRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def create_enrollment(self, _enrollment: Any) -> Any:
            raise AssertionError("create_enrollment should not run for invalid discount code")

    monkeypatch.setattr(admin_enrollments, "Session", _SessionCtx)
    monkeypatch.setattr(admin_enrollments, "get_engine", lambda: object())
    monkeypatch.setattr(admin_enrollments, "set_audit_context", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(admin_enrollments, "parse_body", lambda _event: {})
    monkeypatch.setattr(
        admin_enrollments,
        "parse_create_enrollment_payload",
        lambda _body: {
            "contact_id": uuid4(),
            "family_id": None,
            "organization_id": None,
            "ticket_tier_id": None,
            "discount_code_id": discount_code_id,
            "status": EnrollmentStatus.REGISTERED,
            "amount_paid": None,
            "currency": None,
            "notes": None,
        },
    )
    monkeypatch.setattr(
        admin_enrollments,
        "DiscountCodeRepository",
        _FakeDiscountCodeRepository,
    )
    monkeypatch.setattr(
        admin_enrollments,
        "EnrollmentRepository",
        _FakeEnrollmentRepository,
    )
    _patch_enrollment_discount_scope_ok(monkeypatch)

    with pytest.raises(ValidationError, match="Discount code is invalid"):
        admin_enrollments._create_enrollment(
            api_gateway_event(method="POST", path="/v1/admin/services/x/instances/y/enrollments"),
            instance_id=instance_id,
            actor_sub="test-admin-sub-12345",
        )


def test_create_enrollment_with_discount_code_calls_validate_and_increment(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    instance_id = uuid4()
    discount_code_id = uuid4()
    contact_id = uuid4()

    class _FakeSession:
        def commit(self) -> None:
            return None

        def flush(self) -> None:
            return None

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    validate_calls: list[Any] = []

    class _FakeDiscountCodeRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def validate_and_increment(self, code_id: Any) -> bool:
            validate_calls.append(code_id)
            return True

    created_holder: dict[str, Any] = {}

    class _FakeEnrollment:
        def __init__(self, **kwargs: Any) -> None:
            self.__dict__.update(kwargs)

    class _FakeEnrollmentRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def create_enrollment(self, enrollment: Any) -> Any:
            created_holder["discount_code_id"] = enrollment.discount_code_id
            created_holder["amount_paid"] = enrollment.amount_paid
            return enrollment

    monkeypatch.setattr(admin_enrollments, "Session", _SessionCtx)
    monkeypatch.setattr(admin_enrollments, "get_engine", lambda: object())
    monkeypatch.setattr(admin_enrollments, "set_audit_context", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        admin_enrollments,
        "parse_body",
        lambda _event: json.loads(_event["body"]),
    )
    monkeypatch.setattr(
        admin_enrollments,
        "parse_create_enrollment_payload",
        lambda _body: {
            "contact_id": contact_id,
            "family_id": None,
            "organization_id": None,
            "ticket_tier_id": None,
            "discount_code_id": discount_code_id,
            "status": EnrollmentStatus.REGISTERED,
            "amount_paid": None,
            "currency": None,
            "notes": None,
        },
    )
    monkeypatch.setattr(
        admin_enrollments,
        "DiscountCodeRepository",
        _FakeDiscountCodeRepository,
    )
    monkeypatch.setattr(admin_enrollments, "Enrollment", _FakeEnrollment)
    monkeypatch.setattr(
        admin_enrollments,
        "EnrollmentRepository",
        _FakeEnrollmentRepository,
    )

    class _FakeServiceInstanceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_id(self, _instance_id: Any) -> None:
            return None

    monkeypatch.setattr(
        admin_enrollments,
        "ServiceInstanceRepository",
        _FakeServiceInstanceRepository,
    )
    monkeypatch.setattr(
        admin_enrollments,
        "serialize_enrollment",
        lambda e: {"id": "new-1", "discount_code_id": str(e.discount_code_id)},
    )
    _patch_enrollment_discount_scope_ok(monkeypatch)

    response = admin_enrollments._create_enrollment(
        api_gateway_event(
            method="POST",
            path="/v1/admin/services/x/instances/y/enrollments",
            body=json.dumps({"contact_id": str(contact_id), "discount_code_id": str(discount_code_id)}),
        ),
        instance_id=instance_id,
        actor_sub="test-admin-sub-12345",
    )

    assert response["statusCode"] == 201
    assert validate_calls == [discount_code_id]
    assert created_holder["discount_code_id"] == discount_code_id
    assert created_holder["amount_paid"] is None


def test_update_enrollment_discount_swaps_usage_counts(monkeypatch: Any, api_gateway_event: Any) -> None:
    target_instance_id = uuid4()
    enrollment_id = uuid4()
    old_dc = uuid4()
    new_dc = uuid4()

    class _FakeEnrollment:
        instance_id = target_instance_id
        discount_code_id = old_dc
        status = EnrollmentStatus.REGISTERED
        cancelled_at = None
        amount_paid = None
        currency = None
        notes = None

    decrement_calls: list[Any] = []
    increment_calls: list[Any] = []

    class _FakeDiscountRepo:
        def __init__(self, _session: Any) -> None:
            pass

        def decrement_uses(self, code_id: Any) -> bool:
            decrement_calls.append(code_id)
            return True

        def validate_and_increment(self, code_id: Any) -> bool:
            increment_calls.append(code_id)
            return True

    class _FakeEnrollmentRepo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_id(self, eid: Any) -> Any:
            if eid == enrollment_id:
                return _FakeEnrollment()
            return None

        def update(self, enrollment: Any) -> Any:
            return enrollment

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

    monkeypatch.setattr(admin_enrollments, "Session", _SessionCtx)
    monkeypatch.setattr(admin_enrollments, "get_engine", lambda: object())
    monkeypatch.setattr(admin_enrollments, "set_audit_context", lambda *_a, **_k: None)
    monkeypatch.setattr(
        admin_enrollments,
        "parse_body",
        lambda _e: json.loads(_e["body"]),
    )
    monkeypatch.setattr(
        admin_enrollments,
        "parse_update_enrollment_payload",
        lambda _body: {"discount_code_id": new_dc},
    )
    monkeypatch.setattr(admin_enrollments, "EnrollmentRepository", _FakeEnrollmentRepo)
    monkeypatch.setattr(admin_enrollments, "DiscountCodeRepository", _FakeDiscountRepo)
    monkeypatch.setattr(
        admin_enrollments,
        "serialize_enrollment",
        lambda e: {"id": str(enrollment_id), "discount_code_id": str(e.discount_code_id)},
    )
    _patch_enrollment_discount_scope_ok(monkeypatch)

    resp = admin_enrollments._update_enrollment(
        api_gateway_event(
            method="PATCH",
            path="/v1/admin/services/x/instances/y/enrollments/z",
            body=json.dumps({"discount_code_id": str(new_dc)}),
        ),
        instance_id=target_instance_id,
        enrollment_id=enrollment_id,
        actor_sub="test-admin-sub-12345",
    )
    assert resp["statusCode"] == 200
    assert decrement_calls == [old_dc]
    assert increment_calls == [new_dc]


def test_delete_enrollment_decrements_discount_usage(monkeypatch: Any, api_gateway_event: Any) -> None:
    target_instance_id = uuid4()
    enrollment_id = uuid4()
    dc_id = uuid4()

    class _FakeEnrollment:
        instance_id = target_instance_id
        discount_code_id = dc_id

    decrement_calls: list[Any] = []

    class _FakeDiscountRepo:
        def __init__(self, _session: Any) -> None:
            pass

        def decrement_uses(self, code_id: Any) -> bool:
            decrement_calls.append(code_id)
            return True

    class _FakeEnrollmentRepo:
        def __init__(self, _session: Any) -> None:
            pass

        def get_by_id(self, eid: Any) -> Any:
            if eid == enrollment_id:
                return _FakeEnrollment()
            return None

        def delete(self, _enrollment: Any) -> None:
            return None

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

    monkeypatch.setattr(admin_enrollments, "Session", _SessionCtx)
    monkeypatch.setattr(admin_enrollments, "get_engine", lambda: object())
    monkeypatch.setattr(admin_enrollments, "set_audit_context", lambda *_a, **_k: None)
    monkeypatch.setattr(admin_enrollments, "EnrollmentRepository", _FakeEnrollmentRepo)
    monkeypatch.setattr(admin_enrollments, "DiscountCodeRepository", _FakeDiscountRepo)

    resp = admin_enrollments._delete_enrollment(
        api_gateway_event(method="DELETE", path="/v1/admin/services/x/instances/y/enrollments/z"),
        instance_id=target_instance_id,
        enrollment_id=enrollment_id,
        actor_sub="test-admin-sub-12345",
    )
    assert resp["statusCode"] == 204
    assert decrement_calls == [dc_id]
