from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import pytest

from app.api import admin_enrollments
from app.db.models.enums import EnrollmentStatus
from app.exceptions import ValidationError


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
    monkeypatch.setattr(
        admin_enrollments,
        "serialize_enrollment",
        lambda e: {"id": "new-1", "discount_code_id": str(e.discount_code_id)},
    )

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
