from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any


def _load_handler_module() -> Any:
    module_path = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "lambda"
        / "manager_request_processor"
        / "handler.py"
    )
    spec = importlib.util.spec_from_file_location(
        "test_manager_request_processor_handler",
        module_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module at {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_lambda_handler_skips_unknown_event_type() -> None:
    handler = _load_handler_module()
    event = {
        "Records": [
            {
                "body": json.dumps(
                    {
                        "Message": json.dumps(
                            {
                                "event_type": "unknown.event",
                                "ticket_id": "ticket-1",
                            }
                        )
                    }
                )
            }
        ]
    }

    response = handler.lambda_handler(event, None)
    body = json.loads(response["body"])
    assert body["processed"] == 0
    assert body["skipped"] == 1


def test_send_notification_email_retries_transient_send_failures(
    monkeypatch: Any,
) -> None:
    handler = _load_handler_module()
    monkeypatch.setenv("SUPPORT_EMAIL", "support@example.com")
    monkeypatch.setenv("SES_SENDER_EMAIL", "sender@example.com")
    monkeypatch.setenv("SES_TEMPLATE_NEW_ACCESS_REQUEST", "")

    monkeypatch.setattr(
        handler,
        "render_new_request_email",
        lambda **_: SimpleNamespace(
            subject="subject",
            body_text="body",
            body_html=None,
        ),
    )
    monkeypatch.setattr(
        handler,
        "build_new_request_template_data",
        lambda **_: {},
    )

    attempts = {"count": 0}

    def _flaky_send_email(**_: Any) -> None:
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise ConnectionError("temporary SES network issue")

    monkeypatch.setattr(handler, "send_email", _flaky_send_email)

    ticket = SimpleNamespace(
        ticket_type=handler.TicketType.ACCESS_REQUEST,
        ticket_id="ticket-2",
        submitter_email="submitter@example.com",
        organization_name="Example Org",
        message="Help request",
        created_at=None,
    )
    handler._send_notification_email(ticket)

    assert attempts["count"] == 2
