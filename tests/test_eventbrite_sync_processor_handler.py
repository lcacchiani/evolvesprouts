from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any
from uuid import UUID


def _load_handler_module() -> Any:
    module_path = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "lambda"
        / "eventbrite_sync_processor"
        / "handler.py"
    )
    spec = importlib.util.spec_from_file_location(
        "test_eventbrite_sync_processor_handler",
        module_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module at {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _sqs_record(message: dict[str, Any]) -> dict[str, Any]:
    return {"body": json.dumps({"Message": json.dumps(message)})}


def test_lambda_handler_skips_unknown_event_type() -> None:
    handler = _load_handler_module()
    event = {
        "Records": [
            _sqs_record(
                {
                    "event_type": "unknown.event",
                    "instance_id": "11111111-1111-1111-1111-111111111111",
                }
            )
        ]
    }

    response = handler.lambda_handler(event, None)
    body = json.loads(response["body"])

    assert body["processed"] == 0
    assert body["skipped"] == 1


def test_lambda_handler_processes_event_instance(monkeypatch: Any) -> None:
    handler = _load_handler_module()
    instance_id = UUID("22222222-2222-2222-2222-222222222222")

    class _FakeService:
        def __init__(self, service_type: Any) -> None:
            self.service_type = service_type

    class _FakeInstance:
        def __init__(self, service: Any) -> None:
            self.service = service

    class _FakeRepository:
        def __init__(self, _session: Any) -> None:
            self._instance = _FakeInstance(_FakeService(handler.ServiceType.EVENT))

        def get_by_id_with_details(self, _instance_id: UUID) -> Any:
            return self._instance

    class _FakeSession:
        def __init__(self, _engine: Any) -> None:
            pass

        def __enter__(self) -> _FakeSession:
            return self

        def __exit__(self, _exc_type: Any, _exc: Any, _tb: Any) -> None:
            return None

    seen_sync_ids: list[UUID] = []
    monkeypatch.setattr(handler, "Session", _FakeSession)
    monkeypatch.setattr(handler, "get_engine", lambda: object())
    monkeypatch.setattr(handler, "ServiceInstanceRepository", _FakeRepository)
    monkeypatch.setattr(
        handler,
        "sync_instance_to_eventbrite",
        lambda *, session, instance_id: seen_sync_ids.append(instance_id),
    )

    event = {
        "Records": [
            _sqs_record(
                {
                    "event_type": handler.EVENT_TYPE_INSTANCE_SYNC_REQUESTED,
                    "instance_id": str(instance_id),
                }
            )
        ]
    }
    response = handler.lambda_handler(event, None)
    body = json.loads(response["body"])

    assert body["processed"] == 1
    assert body["skipped"] == 0
    assert seen_sync_ids == [instance_id]
