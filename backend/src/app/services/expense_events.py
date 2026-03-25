"""Helpers for publishing expense-related async events."""

from __future__ import annotations

from datetime import UTC, datetime
import json
import os
from uuid import UUID

from app.exceptions import ValidationError
from app.services.aws_clients import get_sns_client

EVENT_TYPE_PARSE_REQUESTED = "expense.parse_requested"


def enqueue_expense_parse(
    expense_id: UUID,
    *,
    requested_at: datetime | None = None,
) -> None:
    """Publish an expense parse request to the configured SNS topic."""
    topic_arn = os.getenv("EXPENSE_PARSE_TOPIC_ARN", "").strip()
    if not topic_arn:
        raise ValidationError(
            "Expense parser topic is not configured", field="configuration"
        )
    effective_requested_at = requested_at or datetime.now(UTC)
    get_sns_client().publish(
        TopicArn=topic_arn,
        Message=json.dumps(
            {
                "event_type": EVENT_TYPE_PARSE_REQUESTED,
                "expense_id": str(expense_id),
                "requested_at": effective_requested_at.isoformat(),
            }
        ),
        MessageAttributes={
            "event_type": {
                "DataType": "String",
                "StringValue": EVENT_TYPE_PARSE_REQUESTED,
            }
        },
    )
