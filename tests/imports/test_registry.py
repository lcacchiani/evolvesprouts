"""Tests for legacy importer registry."""

from __future__ import annotations

from collections.abc import Sequence
from collections.abc import Iterator
from typing import Any
from typing import ClassVar
from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from app.imports import entities  # noqa: F401
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.registry import get
from app.imports.registry import known_entities
from app.imports.registry import register
from app.imports import registry


@pytest.fixture(autouse=True)
def _restore_importers() -> Iterator[None]:
    snapshot = dict(registry._IMPORTERS)
    try:
        yield
    finally:
        registry._IMPORTERS.clear()
        registry._IMPORTERS.update(snapshot)


def test_known_entities_includes_expected_importers() -> None:
    expected = frozenset(
        {
            "venues",
            "families",
            "organizations",
            "contacts",
            "notes",
            "link_contact_memberships",
        },
    )
    assert expected.issubset(frozenset(known_entities()))


def test_get_unknown_raises() -> None:
    with pytest.raises(KeyError):
        get("nonexistent_entity")


class _DummyImporter:
    ENTITY: ClassVar[str] = "_registry_dup_test"

    def parse(self, sql_text: str) -> Sequence[Any]:
        return []

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        return ImporterContext()

    def apply(
        self,
        session: Session,
        rows: Sequence[Any],
        ctx: ImporterContext,
        *,
        dry_run: bool,
    ) -> ImportStats:
        return ImportStats(entity=self.ENTITY)

    def format_preview(self, row: Any, mapped_id: UUID | None) -> str:
        return ""


def test_register_duplicate_raises() -> None:
    register(_DummyImporter())
    with pytest.raises(ValueError, match="Duplicate"):
        register(_DummyImporter())
