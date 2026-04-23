"""Tests for event_instance_tags legacy importer."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.imports.entities._legacy_event_common import LegacyEventLabel
from app.imports.entities.event_instance_tags import EventInstanceTagsImporter


def test_fan_out_by_event_id(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_instance_tags as mod

    session = MagicMock(spec=Session)
    i1, i2 = uuid.uuid4(), uuid.uuid4()
    tag = uuid.uuid4()
    exec_all = MagicMock()
    exec_all.all.return_value = [(i1,), (i2,)]
    exec_exists = MagicMock()
    exec_exists.scalar.return_value = False
    session.execute.side_effect = [exec_all, exec_exists, exec_exists]

    rows = [LegacyEventLabel(event_id=5, event_date_id=None, label_id=9)]
    importer = EventInstanceTagsImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(
        ImporterContext(),
        refs_by_entity={
            "labels": {"9": tag},
            "event_services": {"5": uuid.uuid4()},
            "event_instances": {},
        },
    )
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.inserted == 2
    assert session.add.call_count == 2


def test_event_date_id_single(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import event_instance_tags as mod

    session = MagicMock(spec=Session)
    inst = uuid.uuid4()
    tag = uuid.uuid4()
    session.execute.return_value.scalar.return_value = False

    rows = [LegacyEventLabel(event_id=None, event_date_id=3, label_id=9)]
    importer = EventInstanceTagsImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(
        ImporterContext(),
        refs_by_entity={
            "labels": {"9": tag},
            "event_instances": {"3": inst},
            "event_services": {},
        },
    )
    importer.apply(session, rows, ctx, dry_run=False)
    assert session.add.call_count == 1


def test_composite_pk_dedupe(monkeypatch: pytest.MonkeyPatch) -> None:
    session = MagicMock(spec=Session)
    session.execute.return_value.scalar.return_value = True
    rows = [LegacyEventLabel(event_id=None, event_date_id=1, label_id=2)]
    importer = EventInstanceTagsImporter()
    from dataclasses import replace

    from app.imports.base import ImporterContext

    ctx = replace(
        ImporterContext(),
        refs_by_entity={
            "labels": {"2": uuid.uuid4()},
            "event_instances": {"1": uuid.uuid4()},
            "event_services": {},
        },
    )
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.skipped_duplicate == 1
    session.add.assert_not_called()
