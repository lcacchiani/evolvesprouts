from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from app.db.models import InboundEmailStatus
from app.services.inbound_invoice_ingest import InboundInvoiceProcessResult


def _load_handler_module() -> Any:
    from lambda.inbound_invoice_email import handler

    return handler


def test_parse_inbound_notification_uses_s3_alert_details() -> None:
    handler = _load_handler_module()

    notification = handler._parse_inbound_notification(
        {
            "mail": {
                "timestamp": "2026-03-21T10:11:12.000Z",
                "source": "vendor@example.com",
                "messageId": "ses-message-123",
                "destination": ["invoices@inbound.example.com"],
                "commonHeaders": {"subject": "Invoice 123"},
            },
            "receipt": {
                "recipients": ["invoices@inbound.example.com"],
                "spamVerdict": {"status": "PASS"},
                "virusVerdict": {"status": "PASS"},
                "spfVerdict": {"status": "FAIL"},
                "dkimVerdict": {"status": "PASS"},
                "dmarcVerdict": {"status": "GRAY"},
                "action": {
                    "bucketName": "raw-email-bucket",
                    "objectKey": "raw/ses-message-123",
                },
            },
        }
    )

    assert notification.ses_message_id == "ses-message-123"
    assert notification.recipient == "invoices@inbound.example.com"
    assert notification.raw_s3_bucket == "raw-email-bucket"
    assert notification.raw_s3_key == "raw/ses-message-123"
    assert notification.spam_status == "PASS"
    assert notification.virus_status == "PASS"
    assert notification.spf_status == "FAIL"


def test_lambda_handler_counts_processed_and_skipped(monkeypatch: Any) -> None:
    handler = _load_handler_module()

    def _fake_process(notification: Any) -> InboundInvoiceProcessResult:
        if notification.ses_message_id == "store-me":
            return InboundInvoiceProcessResult(
                status=InboundEmailStatus.STORED,
                expense_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            )
        return InboundInvoiceProcessResult(status=InboundEmailStatus.SKIPPED)

    monkeypatch.setattr(handler, "process_inbound_invoice_email", _fake_process)

    event = {
        "Records": [
            {
                "body": json.dumps(
                    {
                        "Message": json.dumps(
                            {
                                "mail": {
                                    "timestamp": "2026-03-21T10:11:12.000Z",
                                    "source": "vendor@example.com",
                                    "messageId": "store-me",
                                    "destination": ["invoices@inbound.example.com"],
                                },
                                "receipt": {
                                    "recipients": ["invoices@inbound.example.com"],
                                    "action": {
                                        "bucketName": "raw-bucket",
                                        "objectKey": "raw/store-me",
                                    },
                                },
                            }
                        )
                    }
                )
            },
            {
                "body": json.dumps(
                    {
                        "Message": json.dumps(
                            {
                                "mail": {
                                    "timestamp": "2026-03-21T10:11:13.000Z",
                                    "source": "spam@example.com",
                                    "messageId": "skip-me",
                                    "destination": ["invoices@inbound.example.com"],
                                },
                                "receipt": {
                                    "recipients": ["invoices@inbound.example.com"],
                                    "action": {
                                        "bucketName": "raw-bucket",
                                        "objectKey": "raw/skip-me",
                                    },
                                },
                            }
                        )
                    }
                )
            },
        ]
    }

    response = handler.lambda_handler(event, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 200
    assert body == {"processed": 1, "skipped": 1}
