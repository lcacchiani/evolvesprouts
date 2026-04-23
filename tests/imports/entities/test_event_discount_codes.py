"""Tests for event_discount_codes legacy importer."""

from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.db.models.enums import DiscountType
from app.imports.entities._legacy_event_common import LegacyDiscount
from app.imports.entities.event_discount_codes import EventDiscountCodesImporter


def test_negative_absolute_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_discount_codes as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)

    def _exec(*_a: object, **_k: object) -> MagicMock:
        m = MagicMock()
        m.scalar_one_or_none.return_value = None
        return m

    session.execute.side_effect = _exec

    rows = [
        LegacyDiscount(
            legacy_id=1,
            code="BAD",
            type="absolute",
            value=Decimal("-1"),
            valid_from=None,
            valid_to=None,
            max_uses=None,
            event_id=None,
            event_date_id=None,
            deleted_at=None,
        ),
    ]
    importer = EventDiscountCodesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(ImporterContext(), existing_import_keys=frozenset())
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.skipped_invalid == 1


def test_scope_instance(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_discount_codes as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    inst = uuid.uuid4()

    def _exec(*_a: object, **_k: object) -> MagicMock:
        m = MagicMock()
        m.scalar_one_or_none.return_value = None
        return m

    session.execute.side_effect = _exec

    rows = [
        LegacyDiscount(
            legacy_id=2,
            code="tenoff",
            type="percentage",
            value=Decimal("10"),
            valid_from=None,
            valid_to=None,
            max_uses=1,
            event_id=None,
            event_date_id=7,
            deleted_at=None,
        ),
    ]
    importer = EventDiscountCodesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={"event_instances": {"7": inst}},
    )

    new_id = uuid.uuid4()

    def _flush() -> None:
        obj = session.add.call_args[0][0]
        obj.id = new_id

    session.flush.side_effect = _flush
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.inserted == 1
    dc = session.add.call_args[0][0]
    assert dc.instance_id == inst
    assert dc.discount_type == DiscountType.PERCENTAGE


def test_reuse_existing_code_uppercase(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_discount_codes as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    existing = uuid.uuid4()

    def _exec(*_a: object, **_k: object) -> MagicMock:
        m = MagicMock()
        m.scalar_one_or_none.return_value = existing
        return m

    session.execute.side_effect = _exec

    rows = [
        LegacyDiscount(
            legacy_id=4,
            code="dup",
            type="referral",
            value=Decimal("0"),
            valid_from=None,
            valid_to=None,
            max_uses=None,
            event_id=None,
            event_date_id=None,
            deleted_at=None,
        ),
    ]
    importer = EventDiscountCodesImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(ImporterContext(), existing_import_keys=frozenset())
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.inserted == 1
    session.add.assert_not_called()
    mod.refs.record_mapping.assert_called_once_with(
        session,
        "event_discount_codes",
        "4",
        existing,
    )
