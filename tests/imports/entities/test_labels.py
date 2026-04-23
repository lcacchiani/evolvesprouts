"""Tests for labels legacy importer."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.imports.entities._legacy_event_common import LegacyLabel
from app.imports.entities.labels import LabelsImporter


def test_apply_inserts_and_case_insensitive_reuse(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import labels as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    new_id = uuid.uuid4()

    def _flush() -> None:
        obj = session.add.call_args[0][0]
        obj.id = new_id

    session.flush.side_effect = _flush

    exec_result = MagicMock()
    session.execute.return_value = exec_result
    exec_result.all.return_value = []

    rows = [
        LegacyLabel(legacy_id=1, name="  Alpha  ", entity="tag", deleted_at=None),
        LegacyLabel(legacy_id=2, name="alpha", entity="category", deleted_at=None),
    ]
    importer = LabelsImporter()
    ctx = importer.resolve_context(session, dry_run=False)
    from dataclasses import replace

    ctx = replace(ctx, existing_import_keys=frozenset())
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.inserted == 1
    assert mod.refs.record_mapping.call_count == 2
    assert session.add.call_count == 1


def test_category_description_on_tag(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import labels as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock(spec=Session)
    new_id = uuid.uuid4()

    def _flush() -> None:
        obj = session.add.call_args[0][0]
        obj.id = new_id

    session.flush.side_effect = _flush
    session.execute.return_value.all.return_value = []

    rows = [LegacyLabel(legacy_id=9, name="Cat", entity="category", deleted_at=None)]
    importer = LabelsImporter()
    ctx = importer.resolve_context(session, dry_run=False)
    from dataclasses import replace

    ctx = replace(ctx, existing_import_keys=frozenset())
    importer.apply(session, rows, ctx, dry_run=False)
    tag = session.add.call_args[0][0]
    assert tag.description == "legacy category"
