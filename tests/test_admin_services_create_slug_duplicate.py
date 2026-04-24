"""Regression: duplicate referral slug must return 409, not 500."""

from __future__ import annotations

import json
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError

from app.api import admin_services
from app.db.models import Service, TrainingCourseDetails
from app.exceptions import ValidationError


def _make_services_slug_tier_integrity_error() -> IntegrityError:
    class _Diag:
        constraint_name = "services_slug_tier_unique_idx"

    class _Orig:
        diag = _Diag()

    return IntegrityError("duplicate key", None, _Orig())


def test_create_service_duplicate_slug_maps_to_validation_error(
    monkeypatch: pytest.MonkeyPatch,
    api_gateway_event: Any,
    admin_identity: dict[str, str],
) -> None:
    class _FakeSession:
        def __init__(self) -> None:
            self.committed = False

        def commit(self) -> None:
            self.committed = True

        def rollback(self) -> None:
            pass

    class _SessionCtx:
        def __init__(self, _engine: Any) -> None:
            self._session = _FakeSession()

        def __enter__(self) -> _FakeSession:
            return self._session

        def __exit__(self, *_args: Any) -> bool:
            return False

    class _FakeServiceRepository:
        def __init__(self, _session: Any) -> None:
            pass

        def create_service(self, _service: Service, _details: TrainingCourseDetails) -> Service:
            raise _make_services_slug_tier_integrity_error()

    monkeypatch.setattr(admin_services, "Session", _SessionCtx)
    monkeypatch.setattr(admin_services, "get_engine", lambda: object())
    monkeypatch.setattr(admin_services, "set_audit_context", lambda *_a, **_k: None)
    monkeypatch.setattr(admin_services, "ServiceRepository", _FakeServiceRepository)
    monkeypatch.setattr(admin_services, "require_assignable_tag", lambda *_a, **_k: None)

    body = {
        "service_type": "training_course",
        "title": "Another course",
        "slug": "existing-slug",
        "service_tier": "shared-tier",
        "delivery_mode": "online",
        "status": "draft",
        "tag_ids": [],
        "asset_ids": [],
        "training_details": {
            "pricing_unit": "per_person",
            "default_price": "10.00",
            "default_currency": "HKD",
        },
    }
    event = api_gateway_event(
        method="POST",
        path="/v1/admin/services",
        body=json.dumps(body),
        authorizer_context=admin_identity,
    )

    with pytest.raises(ValidationError) as exc_info:
        admin_services._create_service(event, actor_sub="actor")
    assert exc_info.value.status_code == 409
    assert exc_info.value.field == "slug"
    assert "slug" in exc_info.value.message.lower()
