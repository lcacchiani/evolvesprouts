"""SQS batch processing helpers for Lambda handlers."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any
from collections.abc import Iterator, Mapping

from app.events.sqs_sns import record_message_id


@dataclass
class SqsBatchResult:
    """Track per-record SQS processing outcomes."""

    processed: int = 0
    skipped: int = 0
    failed_item_ids: list[str] = field(default_factory=list)

    def mark_processed(self) -> None:
        self.processed += 1

    def mark_skipped(self) -> None:
        self.skipped += 1

    def mark_failed(self, record: Mapping[str, Any]) -> None:
        message_id = record.get("messageId")
        if isinstance(message_id, str) and message_id.strip():
            self.failed_item_ids.append(message_id.strip())
            return
        # Without itemIdentifier Lambda cannot retry only this record. Count it
        # as skipped so callers still get accurate observability.
        self.skipped += 1

    def to_lambda_response(self) -> dict[str, Any]:
        return {
            "batchItemFailures": [
                {"itemIdentifier": item_id} for item_id in self.failed_item_ids
            ],
            "processed": self.processed,
            "skipped": self.skipped,
        }


class SqsBatchProcessor:
    """Track SQS partial batch outcomes with consistent logging."""

    def __init__(self, *, logger: Any) -> None:
        self._logger = logger
        self._result = SqsBatchResult()

    @property
    def processed(self) -> int:
        return self._result.processed

    @processed.setter
    def processed(self, value: int) -> None:
        self._result.processed = value

    @property
    def skipped(self) -> int:
        return self._result.skipped

    @skipped.setter
    def skipped(self, value: int) -> None:
        self._result.skipped = value

    @property
    def failures(self) -> list[str]:
        return self._result.failed_item_ids

    def process(self) -> None:
        self._result.mark_processed()

    def skip(self) -> None:
        self._result.mark_skipped()

    def fail_record(self, record: Mapping[str, Any], message: str) -> None:
        self._logger.exception(
            message,
            extra={"message_id": record_message_id(record) or None},
        )
        self._result.mark_failed(record)

    @contextmanager
    def record(
        self,
        record: Mapping[str, Any],
        *,
        failure_message: str = "Failed to process SQS message",
    ) -> Iterator[None]:
        try:
            yield
        except Exception:
            self.fail_record(record, failure_message)

    def summary(self) -> dict[str, int]:
        return {
            "processed": self.processed,
            "skipped": self.skipped,
            "failed": len(self.failures),
        }

    def response(self) -> dict[str, Any]:
        return self._result.to_lambda_response()
