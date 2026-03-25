from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Any


def _load_handler_module() -> Any:
    backend_root = Path(__file__).resolve().parents[1] / "backend"
    backend_root_str = str(backend_root)
    if backend_root_str not in sys.path:
        sys.path.insert(0, backend_root_str)
    return importlib.import_module("lambda.migrations.handler")


def test_migration_handler_ignores_missing_revision_during_update(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    sent: list[tuple[str, dict[str, Any]]] = []

    monkeypatch.setattr(handler, "get_database_url", lambda: "postgresql://u:p@h/db")
    monkeypatch.setattr(
        handler,
        "_run_with_retry",
        lambda _func, _database_url: (_ for _ in ()).throw(
            RuntimeError("Can't locate revision identified by '0013_add_inbound_email'")
        ),
    )
    monkeypatch.setattr(
        handler,
        "send_cfn_response",
        lambda _event, _context, status, data, physical_id, reason=None: sent.append(
            (status, {"data": data, "physical_id": physical_id, "reason": reason})
        ),
    )

    event = {
        "RequestType": "Update",
        "PhysicalResourceId": "migrations",
        "ResponseURL": "https://example.s3.amazonaws.com/test",
        "ResourceProperties": {"MigrationsHash": "old"},
        "OldResourceProperties": {"MigrationsHash": "new"},
    }

    result = handler.lambda_handler(event, None)

    assert result["Data"]["status"] == "skipped"
    assert result["Data"]["reason"] == "database_revision_ahead"
    assert sent[0][0] == "SUCCESS"


def test_migration_handler_does_not_ignore_missing_revision_on_create(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    sent: list[tuple[str, dict[str, Any]]] = []

    monkeypatch.setattr(handler, "get_database_url", lambda: "postgresql://u:p@h/db")
    monkeypatch.setattr(
        handler,
        "_run_with_retry",
        lambda _func, _database_url: (_ for _ in ()).throw(
            RuntimeError("Can't locate revision identified by '0013_add_inbound_email'")
        ),
    )
    monkeypatch.setattr(
        handler,
        "send_cfn_response",
        lambda _event, _context, status, data, physical_id, reason=None: sent.append(
            (status, {"data": data, "physical_id": physical_id, "reason": reason})
        ),
    )

    event = {
        "RequestType": "Create",
        "PhysicalResourceId": "migrations",
        "ResponseURL": "https://example.s3.amazonaws.com/test",
        "ResourceProperties": {"MigrationsHash": "new"},
    }

    result = handler.lambda_handler(event, None)

    assert result["Data"]["status"] == "failed"
    assert sent[0][0] == "FAILED"
