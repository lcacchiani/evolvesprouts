"""Lambda handler dispatch tests."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any
from typing import ClassVar
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session

from app.imports import entities  # noqa: F401
from app.imports import refs
from app.imports.base import DependencyNotMet
from app.imports.base import ImportStats
from app.imports.base import ImporterContext
from app.imports.registry import known_entities
from app.imports.registry import register
from app.imports.registry import _IMPORTERS

_STUB_ENTITY = "_dispatch_stub_entity"
_DEP_STUB_ENTITY = "_dispatch_stub_dep_entity"

_HANDLER_PATH = (
    Path(__file__).resolve().parents[3]
    / "backend"
    / "lambda"
    / "imports"
    / "legacy_crm"
    / "handler.py"
)


def _load_handler():
    spec = importlib.util.spec_from_file_location(
        "legacy_crm_handler_dispatch_test",
        _HANDLER_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load handler")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


class _StubImporter:
    ENTITY: ClassVar[str] = _STUB_ENTITY
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ()
    PII: ClassVar[bool] = False

    def parse(self, sql_text: str) -> list[str]:
        return ["row"]

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        return ImporterContext()

    def apply(
        self,
        session: Session,
        rows: list[str],
        ctx: ImporterContext,
        *,
        dry_run: bool,
    ) -> ImportStats:
        return ImportStats(entity=self.ENTITY, inserted=1)

    def format_preview(self, row: Any, mapped_id: Any) -> str:
        return ""


class _DepStubImporter:
    ENTITY: ClassVar[str] = _DEP_STUB_ENTITY
    DEPENDS_ON: ClassVar[tuple[str, ...]] = ("venues",)
    PII: ClassVar[bool] = False

    def parse(self, sql_text: str) -> list[str]:
        return ["row"]

    def resolve_context(self, session: Session, *, dry_run: bool) -> ImporterContext:
        return ImporterContext()

    def apply(
        self,
        session: Session,
        rows: list[str],
        ctx: ImporterContext,
        *,
        dry_run: bool,
    ) -> ImportStats:
        return ImportStats(entity=self.ENTITY, inserted=1)

    def format_preview(self, row: Any, mapped_id: Any) -> str:
        return ""


def test_lambda_handler_dispatches_stub(mock_env: object, monkeypatch: pytest.MonkeyPatch) -> None:
    if _STUB_ENTITY not in known_entities():
        register(_StubImporter())
    h = _load_handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="buck", MAX_IMPORT_DUMP_BYTES="2097152")

    monkeypatch.setattr(
        h,
        "_download_dump",
        lambda _b, _k, _rid: "INSERT INTO district ...",
    )
    monkeypatch.setattr(h, "get_engine", MagicMock())

    class _Sess:
        def __init__(self, _e: object) -> None:
            pass

        def __enter__(self) -> MagicMock:
            return MagicMock()

        def __exit__(self, *a: object) -> None:
            return None

    monkeypatch.setattr(h, "Session", _Sess)

    ctx = MagicMock()
    ctx.aws_request_id = "abc-def-123"

    out = h.lambda_handler(
        {
            "entity": _STUB_ENTITY,
            "s3_bucket": "buck",
            "s3_key": "dumps/x.sql",
            "dry_run": True,
        },
        ctx,
    )
    assert out["entity"] == _STUB_ENTITY
    assert out["inserted"] == 1
    assert out.get("preview_allowed") is True


def test_lambda_handler_raises_when_dependency_missing(
    mock_env: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if _DEP_STUB_ENTITY not in known_entities():
        register(_DepStubImporter())
    h = _load_handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="buck", MAX_IMPORT_DUMP_BYTES="2097152")

    monkeypatch.setattr(
        h,
        "_download_dump",
        lambda _b, _k, _rid: "INSERT INTO district ...",
    )
    monkeypatch.setattr(h, "get_engine", MagicMock())
    monkeypatch.setattr(refs, "has_mapping", lambda _s, _dep: False)

    class _Sess:
        def __init__(self, _e: object) -> None:
            pass

        def __enter__(self) -> MagicMock:
            return MagicMock()

        def __exit__(self, *a: object) -> None:
            return None

    monkeypatch.setattr(h, "Session", _Sess)

    ctx = MagicMock()
    ctx.aws_request_id = "abc-def-123"

    with pytest.raises(DependencyNotMet):
        h.lambda_handler(
            {
                "entity": _DEP_STUB_ENTITY,
                "s3_bucket": "buck",
                "s3_key": "dumps/x.sql",
                "dry_run": False,
            },
            ctx,
        )


def test_lambda_handler_allows_missing_dependency_in_dry_run(
    mock_env: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if _DEP_STUB_ENTITY not in known_entities():
        register(_DepStubImporter())
    h = _load_handler()
    mock_env(IMPORT_DUMP_BUCKET_NAME="buck", MAX_IMPORT_DUMP_BYTES="2097152")

    monkeypatch.setattr(
        h,
        "_download_dump",
        lambda _b, _k, _rid: "INSERT INTO district ...",
    )
    monkeypatch.setattr(h, "get_engine", MagicMock())
    monkeypatch.setattr(refs, "has_mapping", lambda _s, _dep: False)
    monkeypatch.setattr(refs, "load_mapping", lambda _s, _dep: {})

    class _Sess:
        def __init__(self, _e: object) -> None:
            pass

        def __enter__(self) -> MagicMock:
            return MagicMock()

        def __exit__(self, *a: object) -> None:
            return None

    monkeypatch.setattr(h, "Session", _Sess)

    ctx = MagicMock()
    ctx.aws_request_id = "abc-def-123"

    out = h.lambda_handler(
        {
            "entity": _DEP_STUB_ENTITY,
            "s3_bucket": "buck",
            "s3_key": "dumps/x.sql",
            "dry_run": True,
        },
        ctx,
    )
    assert out["entity"] == _DEP_STUB_ENTITY
    assert out["inserted"] == 1


@pytest.fixture(autouse=True)
def _restore_importer_registry() -> Any:
    original = dict(_IMPORTERS)
    try:
        yield
    finally:
        _IMPORTERS.clear()
        _IMPORTERS.update(original)
