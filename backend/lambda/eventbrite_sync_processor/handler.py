"""Lambda handler for Eventbrite sync jobs from SQS."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import ServiceType
from app.db.repositories import ServiceInstanceRepository
from app.events.sqs_batch import SqsBatchProcessor
from app.events.sqs_sns import parse_sqs_sns_message
from app.services.eventbrite_events import EVENT_TYPE_INSTANCE_SYNC_REQUESTED
from app.services.eventbrite_sync import sync_instance_to_eventbrite
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process Eventbrite sync requests delivered through SQS."""
    batch = SqsBatchProcessor(logger=logger)

    for record in event.get("Records", []):
        with batch.record(record):
            message = parse_sqs_sns_message(record)
            if message.get("event_type") != EVENT_TYPE_INSTANCE_SYNC_REQUESTED:
                batch.skip()
                continue

            instance_id_raw = str(message.get("instance_id") or "").strip()
            if not instance_id_raw:
                batch.skip()
                continue
            instance_id = UUID(instance_id_raw)
            if _sync_if_event_instance(instance_id):
                batch.process()
            else:
                batch.skip()

    return batch.response()


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
