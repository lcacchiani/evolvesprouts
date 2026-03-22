from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID

from app.db.models import InboundEmailStatus
from app.services.inbound_invoice_ingest import (
    InboundInvoiceEmailEvent,
    InboundInvoiceProcessResult,
    process_inbound_invoice_email,
)


def _base_event() -> InboundInvoiceEmailEvent:
    return InboundInvoiceEmailEvent(
        ses_message_id="ses-123",
        recipient="invoices@inbound.example.com",
        source_email="billing@example.com",
        subject="Invoice",
        received_at=datetime(2026, 3, 21, 10, 0, tzinfo=UTC),
        raw_s3_bucket="raw-bucket",
        raw_s3_key="inbound-email/raw/ses-123",
    )


def test_process_inbound_invoice_email_reuses_existing_expense(monkeypatch: Any) -> None:
    expense_id = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    ensure_calls: list[UUID] = []

    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest._get_tracking_record",
        lambda _message_id: SimpleNamespace(expense_id=expense_id),
    )
    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest._ensure_parse_requested",
        lambda provided_expense_id: ensure_calls.append(provided_expense_id),
    )

    result = process_inbound_invoice_email(_base_event())

    assert result == InboundInvoiceProcessResult(
        status=InboundEmailStatus.STORED,
        expense_id=expense_id,
    )
    assert ensure_calls == [expense_id]


def test_process_inbound_invoice_email_marks_failed_when_no_supported_attachments(
    monkeypatch: Any,
) -> None:
    upsert_calls: list[tuple[InboundEmailStatus, str | None]] = []

    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest._get_tracking_record",
        lambda _message_id: None,
    )
    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest._load_raw_email",
        lambda _bucket, _key: b"raw-email",
    )
    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest.parse_raw_email",
        lambda _raw_email: SimpleNamespace(
            from_email="billing@example.com",
            subject="Invoice",
            from_name="Vendor",
            attachments=(),
        ),
    )
    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest.invoice_attachments_for_ingest",
        lambda _parsed: [],
    )
    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest._upsert_tracking_record",
        lambda _event, *, status, parsed_email=None, failure_reason=None: upsert_calls.append(
            (status, failure_reason)
        ),
    )

    result = process_inbound_invoice_email(_base_event())

    assert result == InboundInvoiceProcessResult(status=InboundEmailStatus.FAILED)
    assert upsert_calls == [
        (InboundEmailStatus.PROCESSING, None),
        (
            InboundEmailStatus.FAILED,
            "Inbound email does not include supported invoice attachments "
            "or enough body text to parse",
        ),
    ]


def test_process_inbound_invoice_email_skips_spam_without_loading_raw_email(
    monkeypatch: Any,
) -> None:
    event = InboundInvoiceEmailEvent(
        **{**_base_event().__dict__, "spam_status": "FAIL"},
    )
    statuses: list[InboundEmailStatus] = []

    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest._get_tracking_record",
        lambda _message_id: None,
    )
    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest._upsert_tracking_record",
        lambda _event, *, status, parsed_email=None, failure_reason=None: statuses.append(
            status
        ),
    )
    monkeypatch.setattr(
        "app.services.inbound_invoice_ingest._load_raw_email",
        lambda _bucket, _key: (_ for _ in ()).throw(AssertionError("unexpected load")),
    )

    result = process_inbound_invoice_email(event)

    assert result == InboundInvoiceProcessResult(status=InboundEmailStatus.SKIPPED)
    assert statuses == [InboundEmailStatus.SKIPPED]
