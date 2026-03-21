from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any


def _load_handler_module() -> Any:
    module_name = "assets_bucket_migrator_handler"
    module_path = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "lambda"
        / "assets_bucket_migrator"
        / "handler.py"
    )
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _cfn_event() -> dict[str, Any]:
    return {
        "RequestType": "Create",
        "ResponseURL": "https://example.s3.amazonaws.com/test",
        "StackId": "stack-id",
        "RequestId": "request-id",
        "LogicalResourceId": "AssetsBucketMigration",
        "ResourceProperties": {
            "SourceBucketName": "source-bucket",
            "DestinationBucketName": "destination-bucket",
        },
    }


def test_assets_bucket_migrator_skips_when_source_missing(monkeypatch: Any) -> None:
    handler = _load_handler_module()
    sent: list[tuple[str, dict[str, Any]]] = []

    monkeypatch.setattr(handler, "_bucket_exists", lambda _bucket: False)
    monkeypatch.setattr(
        handler,
        "send_cfn_response",
        lambda _event, _context, status, data, physical_id, reason=None: sent.append(
            (status, {"data": data, "physical_id": physical_id, "reason": reason})
        ),
    )

    result = handler.lambda_handler(_cfn_event(), None)

    assert result["Data"]["status"] == "skipped"
    assert sent[0][0] == "SUCCESS"
    assert sent[0][1]["data"]["reason"] == "source_missing"


def test_assets_bucket_migrator_copies_objects(monkeypatch: Any) -> None:
    handler = _load_handler_module()
    sent: list[tuple[str, dict[str, Any]]] = []

    monkeypatch.setattr(handler, "_bucket_exists", lambda _bucket: True)
    monkeypatch.setattr(handler, "_copy_objects", lambda _src, _dst: 3)
    monkeypatch.setattr(
        handler,
        "send_cfn_response",
        lambda _event, _context, status, data, physical_id, reason=None: sent.append(
            (status, {"data": data, "physical_id": physical_id, "reason": reason})
        ),
    )

    result = handler.lambda_handler(_cfn_event(), None)

    assert result["Data"]["status"] == "ok"
    assert result["Data"]["copied_objects"] == 3
    assert sent[0][0] == "SUCCESS"
