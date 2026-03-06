from __future__ import annotations

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
