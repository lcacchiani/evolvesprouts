"""Tests for notes legacy importer."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.imports.entities._legacy_family_common import parse_legacy_notes
from app.imports.entities._legacy_family_common import parse_legacy_person_notes
from app.imports.entities.notes import NotesImporter
from app.imports.entities.notes import apply_notes


NOTE_SQL = """
INSERT INTO `note` (`id`, `created_at`, `took_at`, `content`) VALUES
(1, '2024-01-01 10:00:00', '2024-01-02 15:30:00', 'Hello *world*\\nLine2');
"""

PN_SQL = """
INSERT INTO `person_note` (`note_id`, `person_id`) VALUES (1, 10), (1, 11);
"""


def test_parse_note_multiline() -> None:
    notes = parse_legacy_notes(NOTE_SQL)
    assert len(notes) == 1
    assert "Line2" in notes[0].content


def test_parse_person_note_pairs() -> None:
    pairs = parse_legacy_person_notes(PN_SQL)
    assert pairs == [(1, 10), (1, 11)]


def test_apply_notes_dry_run_two_contacts(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import notes as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock()

    sql = NOTE_SQL + PN_SQL
    importer = NotesImporter()
    rows = importer.parse(sql)
    from dataclasses import replace

    c1 = uuid.uuid4()
    c2 = uuid.uuid4()
    base = importer.resolve_context(session, dry_run=True)
    ctx = replace(
        base,
        refs_by_entity={"contacts": {"10": c1, "11": c2}},
        source_sql_text=sql,
    )
    stats = importer.apply(session, rows, ctx, dry_run=True)
    assert stats.inserted == 1
    assert len(stats.row_details[0]["target"]["tables"]) >= 3
    session.add.assert_not_called()


def test_skipped_no_dep_unresolved(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports.entities import notes as mod

    monkeypatch.setattr(mod.refs, "record_mapping", MagicMock())
    session = MagicMock()
    sql = NOTE_SQL + PN_SQL
    importer = NotesImporter()
    rows = importer.parse(sql)
    from dataclasses import replace

    base = importer.resolve_context(session, dry_run=False)
    ctx = replace(base, refs_by_entity={"contacts": {}}, source_sql_text=sql)
    stats = importer.apply(session, rows, ctx, dry_run=False)
    assert stats.skipped_no_dep == 1


def test_format_preview_masks_content(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports import base as base_mod

    monkeypatch.setattr(base_mod, "mask_pii", lambda t: "***")
    importer = NotesImporter()
    notes = parse_legacy_notes(NOTE_SQL)
    line = importer.format_preview(notes[0], None)
    assert "***" in line
