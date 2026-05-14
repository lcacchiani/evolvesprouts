"""Tests for bulk expense import SQS enqueue."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.exceptions import ValidationError
from app.services.bulk_expense_import_events import enqueue_bulk_expense_import_job


def test_enqueue_bulk_expense_import_requires_queue_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BULK_EXPENSE_IMPORT_QUEUE_URL", raising=False)
    with pytest.raises(ValidationError, match="queue is not configured"):
        enqueue_bulk_expense_import_job(uuid4())


def test_enqueue_bulk_expense_import_sends_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BULK_EXPENSE_IMPORT_QUEUE_URL", "https://sqs.example.com/123/q")
    sent: dict = {}

    class _FakeSqs:
        def send_message(self, **kwargs: object) -> None:
            sent.update(kwargs)

    monkeypatch.setattr(
        "app.services.bulk_expense_import_events.get_sqs_client", lambda: _FakeSqs()
    )
    job_id = uuid4()
    enqueue_bulk_expense_import_job(job_id)
    assert sent.get("QueueUrl") == "https://sqs.example.com/123/q"
    body = sent.get("MessageBody")
    assert isinstance(body, str)
    assert str(job_id) in body
