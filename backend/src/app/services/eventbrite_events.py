"""Helpers for publishing Eventbrite sync requests to SNS."""

from __future__ import annotations

from datetime import UTC, datetime
import json
import os
from uuid import UUID

from app.exceptions import ValidationError
from app.services.aws_clients import get_sns_client

EVENT_TYPE_INSTANCE_SYNC_REQUESTED = "eventbrite.instance_sync_requested"


def enqueue_eventbrite_instance_sync(
    instance_id: UUID,
    *,
    requested_at: datetime | None = None,
) -> None:
    """Publish an Eventbrite sync request for one service instance."""
    topic_arn = os.getenv("EVENTBRITE_SYNC_TOPIC_ARN", "").strip()
    if not topic_arn:
        raise ValidationError(
            "Eventbrite sync topic is not configured",
            field="configuration",
        )

    effective_requested_at = requested_at or datetime.now(UTC)
    payload = {
        "event_type": EVENT_TYPE_INSTANCE_SYNC_REQUESTED,
        "instance_id": str(instance_id),
        "requested_at": effective_requested_at.isoformat(),
    }
    get_sns_client().publish(
        TopicArn=topic_arn,
        Message=json.dumps(payload),
        MessageAttributes={
            "event_type": {
                "DataType": "String",
                "StringValue": EVENT_TYPE_INSTANCE_SYNC_REQUESTED,
            }
        },
    )


def enqueue_eventbrite_instance_sync_by_id(instance_id: UUID | str) -> None:
    """Convenience wrapper that accepts UUID or UUID string."""
    normalized_id = instance_id if isinstance(instance_id, UUID) else UUID(instance_id)
    enqueue_eventbrite_instance_sync(normalized_id)
