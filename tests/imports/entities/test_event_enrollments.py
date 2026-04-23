"""Tests for event_enrollments legacy importer."""

from __future__ import annotations

import uuid
from datetime import UTC
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.imports.entities._legacy_event_common import LegacyRegistration
from app.imports.entities.event_enrollments import EventEnrollmentsImporter


def test_anonymous_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_enrollments as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    session.execute.return_value.scalar_one_or_none.return_value = None

    rows = [
        LegacyRegistration(
            legacy_id=1,
            event_date_id=10,
            person_id=None,
            family_id=None,
            organization_id=None,
            status="paid",
            price=Decimal("10"),
            currency="HKD",
            paid_at=None,
            cancelled_at=None,
            notes=None,
            deleted_at=None,
            discount_id=None,
            created_at=datetime.now(UTC),
        ),
    ]
    importer = EventEnrollmentsImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    inst = uuid.uuid4()
    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={"event_instances": {"10": inst}},
    )
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.skipped_no_dep == 1


def test_reuse_existing_enrollment(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_enrollments as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    existing = uuid.uuid4()
    session.execute.return_value.scalar_one_or_none.return_value = existing

    rows = [
        LegacyRegistration(
            legacy_id=2,
            event_date_id=10,
            person_id=99,
            family_id=None,
            organization_id=None,
            status="confirmed",
            price=Decimal("50"),
            currency="hkd",
            paid_at=None,
            cancelled_at=None,
            notes=None,
            deleted_at=None,
            discount_id=None,
            created_at=datetime(2020, 1, 1, tzinfo=UTC),
        ),
    ]
    importer = EventEnrollmentsImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    inst = uuid.uuid4()
    cid = uuid.uuid4()
    ctx = replace(
        ImporterContext(),
        existing_import_keys=frozenset(),
        refs_by_entity={
            "event_instances": {"10": inst},
            "contacts": {"99": cid},
        },
    )
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.reused_existing_enrollment == 1
    assert stats.inserted == 0
    mod.refs.record_mapping.assert_called_once()


def test_pii_preview_masked() -> None:
    importer = EventEnrollmentsImporter()
    row = LegacyRegistration(
        legacy_id=3,
        event_date_id=1,
        person_id=1,
        family_id=None,
        organization_id=None,
        status="x",
        price=None,
        currency=None,
        paid_at=None,
        cancelled_at=None,
        notes="secret note",
        deleted_at=None,
        discount_id=None,
        created_at=None,
    )
    preview = importer.format_preview(row, None)
    assert "secret" not in preview
