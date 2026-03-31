"""Lambda handler for Eventbrite sync jobs from SQS."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import ServiceType
from app.db.repositories import ServiceInstanceRepository
from app.services.eventbrite_events import EVENT_TYPE_INSTANCE_SYNC_REQUESTED
from app.services.eventbrite_sync import sync_instance_to_eventbrite
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process Eventbrite sync requests delivered through SQS."""
    processed = 0
    skipped = 0

    for record in event.get("Records", []):
        message = _parse_record_message(record)
        if message.get("event_type") != EVENT_TYPE_INSTANCE_SYNC_REQUESTED:
            skipped += 1
            continue

        instance_id_raw = str(message.get("instance_id") or "").strip()
        if not instance_id_raw:
            skipped += 1
            continue
        instance_id = UUID(instance_id_raw)
        if _sync_if_event_instance(instance_id):
            processed += 1
        else:
            skipped += 1

    return {
        "statusCode": 200,
        "body": json.dumps({"processed": processed, "skipped": skipped}),
    }


def _sync_if_event_instance(instance_id: UUID) -> bool:
    with Session(get_engine()) as session:
        instance_repo = ServiceInstanceRepository(session)

        instance = instance_repo.get_by_id_with_details(instance_id)
        if instance is None:
            logger.warning("Skipping Eventbrite sync for missing instance")
            return False
        if instance.service is None:
            logger.warning("Skipping Eventbrite sync because service is missing")
            return False
        if instance.service.service_type != ServiceType.EVENT:
            return False
        sync_instance_to_eventbrite(session=session, instance_id=instance_id)
        return True


def _parse_record_message(record: dict[str, Any]) -> dict[str, Any]:
    sqs_body = json.loads(record["body"])
    sns_message = sqs_body.get("Message", "{}")
    parsed = json.loads(sns_message)
    if not isinstance(parsed, dict):
        raise ValueError("SNS message payload must be an object")
    return parsed
