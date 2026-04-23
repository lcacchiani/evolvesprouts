"""Tests for shared importer helpers."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from typing import ClassVar
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from app.imports.base import DependencyNotMet
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.base import check_dependencies
from app.imports.base import parse_skip_legacy_keys_csv
from app.imports.base import resolve_importer_context


class _DepImporter:
    ENTITY: ClassVar[str] = "_dep_helper_test"
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ("venues",)
    PII: ClassVar[bool] = False

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


def test_check_dependencies_raises_when_parent_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.imports import refs

    monkeypatch.setattr(refs, "has_mapping", lambda _s, _dep: False)
    with pytest.raises(DependencyNotMet, match="Required dependency entity"):
        check_dependencies(_DepImporter(), MagicMock(spec=Session), dry_run=False)


def test_check_dependencies_organizations_optional_when_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """Contacts depend on families + organizations; org import may be empty."""

    from app.imports import refs

    class _ContactsLikeImporter:
        ENTITY: ClassVar[str] = "_contacts_dep_test"
        DEPENDS_ON: ClassVar[tuple[str, ...]] = ("families", "organizations")
        PII: ClassVar[bool] = True

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

    def _has_mapping(_s: Session, dep: str) -> bool:
        return dep == "families"

    monkeypatch.setattr(refs, "has_mapping", _has_mapping)
    check_dependencies(_ContactsLikeImporter(), MagicMock(spec=Session), dry_run=False)


def test_check_dependencies_labels_optional_for_event_instance_tags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports import refs

    class _TagsImporter:
        ENTITY: ClassVar[str] = "_labels_dep_test"
        DEPENDS_ON: ClassVar[tuple[str, ...]] = ("event_instances", "labels")
        PII: ClassVar[bool] = False

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

    def _has_mapping(_s: Session, dep: str) -> bool:
        return dep == "event_instances"

    monkeypatch.setattr(refs, "has_mapping", _has_mapping)
    check_dependencies(_TagsImporter(), MagicMock(spec=Session), dry_run=False)


def test_check_dependencies_skips_check_during_dry_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports import refs

    called = {"has_mapping": False}

    def _has_mapping(_s: Session, _dep: str) -> bool:
        called["has_mapping"] = True
        return False

    monkeypatch.setattr(refs, "has_mapping", _has_mapping)
    check_dependencies(_DepImporter(), MagicMock(spec=Session), dry_run=True)
    assert called["has_mapping"] is False


def test_resolve_importer_context_attaches_dependency_maps(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports import refs

    monkeypatch.setattr(refs, "has_mapping", lambda _s, _dep: True)
    monkeypatch.setattr(refs, "load_mapping", lambda _s, dep: {"1": UUID(int=1)} if dep == "venues" else {})

    ctx = resolve_importer_context(
        _DepImporter(),
        MagicMock(spec=Session),
        dry_run=False,
    )
    assert "venues" in ctx.refs_by_entity
    assert ctx.refs_by_entity["venues"]["1"] == UUID(int=1)


def test_parse_skip_legacy_keys_csv_trims_and_splits() -> None:
    assert parse_skip_legacy_keys_csv(" 1 , 2 , ") == frozenset({"1", "2"})
    assert parse_skip_legacy_keys_csv("") == frozenset()
    assert parse_skip_legacy_keys_csv(None) == frozenset()


def test_resolve_importer_context_skips_dependency_check_during_dry_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports import refs

    called = {"has_mapping": False}

    def _has_mapping(_s: Session, _dep: str) -> bool:
        called["has_mapping"] = True
        return False

    monkeypatch.setattr(refs, "has_mapping", _has_mapping)
    monkeypatch.setattr(refs, "load_mapping", lambda _s, _dep: {})

    ctx = resolve_importer_context(
        _DepImporter(),
        MagicMock(spec=Session),
        dry_run=True,
    )
    assert ctx.refs_by_entity == {"venues": {}}
    assert called["has_mapping"] is False


def test_resolve_importer_context_loads_all_event_instance_tags_deps(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: DEPENDS_ON entities must be in refs_by_entity for Lambda path."""
    from app.imports import refs
    from app.imports.entities.event_instance_tags import EventInstanceTagsImporter

    def _has_mapping(_s: Session, dep: str) -> bool:
        return dep in {"event_instances", "labels", "event_services"}

    def _load_mapping(_s: Session, dep: str) -> dict[str, UUID]:
        if dep == "event_instances":
            return {"1": UUID(int=1)}
        return {}

    monkeypatch.setattr(refs, "has_mapping", _has_mapping)
    monkeypatch.setattr(refs, "load_mapping", _load_mapping)

    importer = EventInstanceTagsImporter()
    ctx = resolve_importer_context(
        importer,
        MagicMock(spec=Session),
        dry_run=False,
    )
    assert "event_services" in ctx.refs_by_entity
    assert "event_instances" in ctx.refs_by_entity
    assert "labels" in ctx.refs_by_entity


def test_resolve_importer_context_merges_skip_legacy_keys(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.imports import refs

    class _CtxImporter:
        ENTITY: ClassVar[str] = "_ctx_skip_test"
        DEPENDS_ON: ClassVar[tuple[str, ...]] = ()

        def parse(self, sql_text: str) -> Sequence[Any]:
            return []

        def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
            return ImporterContext(skip_legacy_keys=frozenset({"a"}))

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

    monkeypatch.setattr(refs, "has_mapping", lambda _s, _dep: True)
    ctx = resolve_importer_context(
        _CtxImporter(),
        MagicMock(spec=Session),
        dry_run=False,
        skip_legacy_keys=frozenset({"b"}),
    )
    assert ctx.skip_legacy_keys == frozenset({"a", "b"})
