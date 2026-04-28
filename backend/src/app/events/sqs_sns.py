"""Helpers for Lambda handlers that consume SNS notifications through SQS."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any


def parse_sqs_sns_message(record: Mapping[str, Any]) -> dict[str, Any]:
    """Parse the JSON SNS ``Message`` payload from an SQS event record."""
    sqs_body_raw = record.get("body")
    if sqs_body_raw is None:
        raise ValueError("SQS record body is required")
    sqs_body = json.loads(str(sqs_body_raw))
    if not isinstance(sqs_body, Mapping):
        raise ValueError("SQS record body must be a JSON object")

    sns_message = sqs_body.get("Message")
    if sns_message is None:
        raise ValueError("SNS message is required")
    parsed = json.loads(str(sns_message))
    if not isinstance(parsed, dict):
        raise ValueError("SNS message payload must be an object")
    return parsed


def parse_sqs_sns_record(record: Mapping[str, Any]) -> dict[str, Any]:
    """Backward-compatible alias for SNS-over-SQS record parsing."""
    return parse_sqs_sns_message(record)


def record_message_id(record: Mapping[str, Any]) -> str:
    """Return the SQS record identifier used by partial batch failure responses."""
    raw_message_id = record.get("messageId") or record.get("messageID")
    if raw_message_id is None:
        return ""
    return str(raw_message_id)


def sqs_batch_response(*, processed: int, skipped: int) -> dict[str, Any]:
    """Return the legacy summary body used by existing SQS handlers."""
    return {
        "statusCode": 200,
        "body": json.dumps({"processed": processed, "skipped": skipped}),
    }


def partial_batch_response(
    *,
    processed: int,
    skipped: int,
    failed_record_ids: list[str],
) -> dict[str, Any]:
    """Return a summary plus SQS partial batch failure entries."""
    response = sqs_batch_response(processed=processed, skipped=skipped)
    response["batchItemFailures"] = [
        {"itemIdentifier": record_id} for record_id in failed_record_ids if record_id
    ]
    return response
