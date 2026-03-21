"""Lambda handler for inbound invoice email processing."""

from __future__ import annotations

from datetime import datetime
import json
from typing import Any
from collections.abc import Mapping

from app.services.inbound_invoice_ingest import (
    InboundInvoiceEmailEvent,
    process_inbound_invoice_email,
)
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process SES inbound-email notifications delivered through SQS + SNS."""
    processed = 0
    skipped = 0

    for record in event.get("Records", []):
        message = _parse_sqs_sns_record(record)
        notification = _parse_inbound_notification(message)
        result = process_inbound_invoice_email(notification)
        if result.expense_id is None:
            skipped += 1
        else:
            processed += 1

    logger.info(
        "Inbound invoice email batch processed",
        extra={"processed": processed, "skipped": skipped},
    )

    return {
        "statusCode": 200,
        "body": json.dumps({"processed": processed, "skipped": skipped}),
    }


def _parse_sqs_sns_record(record: Mapping[str, Any]) -> dict[str, Any]:
    sqs_body = json.loads(str(record.get("body") or "{}"))
    sns_message = sqs_body.get("Message", "{}")
    parsed = json.loads(str(sns_message))
    if not isinstance(parsed, dict):
        raise ValueError("SNS message payload must be an object")
    return parsed


def _parse_inbound_notification(message: Mapping[str, Any]) -> InboundInvoiceEmailEvent:
    mail = _mapping(message.get("mail"))
    receipt = _mapping(message.get("receipt"))
    action = _mapping(receipt.get("action"))
    ses_message_id = _required_text(mail.get("messageId"), field="mail.messageId")
    recipients = _string_list(mail.get("destination"))
    receipt_recipients = _string_list(receipt.get("recipients"))
    all_recipients = receipt_recipients or recipients
    raw_s3_bucket = _required_text(
        action.get("bucketName"), field="receipt.action.bucketName"
    )
    raw_s3_key = _required_text(
        action.get("objectKey"), field="receipt.action.objectKey"
    )
    source_email = _optional_text(mail.get("source"))
    subject = _optional_text(_mapping(mail.get("commonHeaders")).get("subject"))
    received_at = _parse_timestamp(mail.get("timestamp"))

    return InboundInvoiceEmailEvent(
        ses_message_id=ses_message_id,
        recipient=_required_text(
            all_recipients[0] if all_recipients else None,
            field="mail.destination",
        ),
        source_email=source_email,
        subject=subject,
        received_at=received_at,
        raw_s3_bucket=raw_s3_bucket,
        raw_s3_key=raw_s3_key,
        spam_status=_verdict_status(receipt.get("spamVerdict")),
        virus_status=_verdict_status(receipt.get("virusVerdict")),
        spf_status=_verdict_status(receipt.get("spfVerdict")),
        dkim_status=_verdict_status(receipt.get("dkimVerdict")),
        dmarc_status=_verdict_status(receipt.get("dmarcVerdict")),
    )


def _mapping(value: Any) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    return {}


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _required_text(value: Any, *, field: str) -> str:
    normalized = _optional_text(value)
    if not normalized:
        raise ValueError(f"{field} is required")
    return normalized


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _parse_timestamp(value: Any) -> datetime:
    normalized = _required_text(value, field="mail.timestamp")
    try:
        return datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("mail.timestamp must be an ISO timestamp") from exc


def _verdict_status(value: Any) -> str | None:
    if not isinstance(value, Mapping):
        return None
    status = value.get("status")
    return _optional_text(status)
