"""Tests for discount code eligibility against a service instance."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.api.discount_enrollment_scope import (
    ensure_discount_code_eligible_for_instance,
    service_id_for_instance,
)
from decimal import Decimal

from app.db.models import DiscountCode, ServiceInstance
from app.db.models.enums import DiscountType
from app.exceptions import ValidationError


class _FakeSession:
    def __init__(self, *, discount: DiscountCode | None, instance: ServiceInstance | None):
        self._discount = discount
        self._instance = instance

    def get(self, model: type, entity_id):  # noqa: ANN001
        if model is DiscountCode:
            if self._discount is not None and self._discount.id == entity_id:
                return self._discount
            return None
        if model is ServiceInstance:
            if self._instance is not None and self._instance.id == entity_id:
                return self._instance
            return None
        return None


def test_ensure_discount_accepts_global_code() -> None:
    sid = uuid4()
    iid = uuid4()
    dc_id = uuid4()
    dc = DiscountCode(
        id=dc_id,
        code="G",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("10"),
        service_id=None,
        instance_id=None,
        created_by="test",
    )
    inst = ServiceInstance(id=iid, service_id=sid)
    session = _FakeSession(discount=dc, instance=inst)
    assert ensure_discount_code_eligible_for_instance(
        session, discount_code_id=dc_id, service_id=sid, instance_id=iid
    ) is dc


def test_ensure_discount_rejects_wrong_service() -> None:
    sid = uuid4()
    other = uuid4()
    iid = uuid4()
    dc_id = uuid4()
    dc = DiscountCode(
        id=dc_id,
        code="S",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("10"),
        service_id=other,
        instance_id=None,
        created_by="test",
    )
    inst = ServiceInstance(id=iid, service_id=sid)
    session = _FakeSession(discount=dc, instance=inst)
    with pytest.raises(ValidationError, match="not valid"):
        ensure_discount_code_eligible_for_instance(
            session, discount_code_id=dc_id, service_id=sid, instance_id=iid
        )


def test_ensure_discount_rejects_wrong_instance() -> None:
    sid = uuid4()
    iid = uuid4()
    other_i = uuid4()
    dc_id = uuid4()
    dc = DiscountCode(
        id=dc_id,
        code="I",
        discount_type=DiscountType.PERCENTAGE,
        discount_value=Decimal("10"),
        service_id=sid,
        instance_id=other_i,
        created_by="test",
    )
    inst = ServiceInstance(id=iid, service_id=sid)
    session = _FakeSession(discount=dc, instance=inst)
    with pytest.raises(ValidationError, match="not valid"):
        ensure_discount_code_eligible_for_instance(
            session, discount_code_id=dc_id, service_id=sid, instance_id=iid
        )


def test_service_id_for_instance() -> None:
    sid = uuid4()
    iid = uuid4()
    inst = ServiceInstance(id=iid, service_id=sid)
    session = _FakeSession(discount=None, instance=inst)
    assert service_id_for_instance(session, iid) == sid


def test_service_id_for_missing_instance() -> None:
    session = _FakeSession(discount=None, instance=None)
    with pytest.raises(ValidationError, match="not found"):
        service_id_for_instance(session, uuid4())
