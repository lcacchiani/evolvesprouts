"""Admin billing: CSV export."""

from __future__ import annotations

import csv
import io
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import select

from app.api.admin_billing_common import _session_with_audit
from app.api.admin_request import query_param
from app.db.models.customer_invoice import CustomerInvoice, CustomerInvoiceLine
from app.db.models.customer_payment import CustomerPayment
from app.db.models.customer_receipt import CustomerReceipt
from app.db.models.enums import BillingPaymentDirection
from app.db.models.payment_allocation import PaymentAllocation
from app.exceptions import ValidationError
from app.utils import json_response


def _export_csv(
    event: Mapping[str, Any], *, user_sub: str, request_id: str | None
) -> dict[str, Any]:
    raw_ver = (
        (
            query_param(event, "exportVersion")
            or query_param(event, "export_version")
            or "2"
        )
        .strip()
        .lower()
    )
    if raw_ver not in ("1", "2"):
        raise ValidationError("exportVersion must be 1 or 2", field="exportVersion")

    with _session_with_audit(user_sub, request_id) as session:
        if raw_ver == "1":
            payments = (
                session.execute(
                    select(CustomerPayment)
                    .order_by(CustomerPayment.created_at.desc())
                    .limit(5000)
                )
                .scalars()
                .all()
            )
            allocs = (
                session.execute(select(PaymentAllocation).limit(10000)).scalars().all()
            )
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow(
                [
                    "export_version",
                    "document_type",
                    "document_id",
                    "amount",
                    "currency",
                    "stripe_payment_intent_id",
                    "stripe_refund_id",
                    "enrollment_id",
                    "created_at",
                ]
            )
            for p in payments:
                w.writerow(
                    [
                        "1",
                        "payment",
                        str(p.id),
                        str(p.amount),
                        p.currency,
                        p.stripe_payment_intent_id or "",
                        p.stripe_refund_id or "",
                        str(p.enrollment_id) if p.enrollment_id else "",
                        p.created_at.isoformat(),
                    ]
                )
            for a in allocs:
                w.writerow(
                    [
                        "1",
                        "allocation",
                        str(a.id),
                        str(a.allocated_amount),
                        a.currency,
                        "",
                        "",
                        "",
                        a.created_at.isoformat(),
                    ]
                )
            return json_response(200, {"csv": buf.getvalue()}, event=event)

        payments = (
            session.execute(
                select(CustomerPayment)
                .order_by(CustomerPayment.created_at.desc())
                .limit(5000)
            )
            .scalars()
            .all()
        )
        allocs = session.execute(select(PaymentAllocation).limit(10000)).scalars().all()
        invoices = (
            session.execute(
                select(CustomerInvoice)
                .order_by(CustomerInvoice.created_at.desc())
                .limit(5000)
            )
            .scalars()
            .all()
        )
        inv_ids = [i.id for i in invoices]
        lines_by_invoice: dict[UUID, list[CustomerInvoiceLine]] = {}
        if inv_ids:
            line_rows = (
                session.execute(
                    select(CustomerInvoiceLine)
                    .where(CustomerInvoiceLine.invoice_id.in_(inv_ids))
                    .order_by(
                        CustomerInvoiceLine.invoice_id,
                        CustomerInvoiceLine.line_order,
                    )
                )
                .scalars()
                .all()
            )
            for ln in line_rows:
                lines_by_invoice.setdefault(ln.invoice_id, []).append(ln)
        receipts = (
            session.execute(
                select(CustomerReceipt)
                .order_by(CustomerReceipt.created_at.desc())
                .limit(5000)
            )
            .scalars()
            .all()
        )

        def _snap_name(snap: Any) -> str:
            if not snap:
                return ""
            v = snap.get("display_name")
            return str(v) if v else ""

        def _payment_doc_type(p: CustomerPayment) -> str:
            if p.direction == BillingPaymentDirection.REFUND:
                return "refund"
            return "payment"

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            [
                "export_version",
                "document_type",
                "document_id",
                "parent_document_id",
                "amount",
                "currency",
                "payment_method",
                "bank_reference",
                "counterparty_name_snapshot",
                "tax_amount",
                "created_by",
                "stripe_payment_intent_id",
                "stripe_refund_id",
                "original_payment_id",
                "bill_to_kind",
                "bill_to_email",
                "bill_to_display_name",
                "invoice_number",
                "enrollment_id",
                "invoice_line_id",
                "created_at",
            ]
        )
        for p in payments:
            w.writerow(
                [
                    "2",
                    _payment_doc_type(p),
                    str(p.id),
                    str(p.original_payment_id) if p.original_payment_id else "",
                    str(p.amount),
                    p.currency,
                    p.method,
                    p.external_reference or "",
                    "",
                    "",
                    p.confirmed_by or "",
                    p.stripe_payment_intent_id or "",
                    p.stripe_refund_id or "",
                    str(p.original_payment_id) if p.original_payment_id else "",
                    "",
                    "",
                    "",
                    "",
                    str(p.enrollment_id) if p.enrollment_id else "",
                    "",
                    p.created_at.isoformat(),
                ]
            )
        for inv in invoices:
            snap = inv.bill_to_snapshot or {}
            w.writerow(
                [
                    "2",
                    "invoice",
                    str(inv.id),
                    "",
                    str(inv.total),
                    inv.currency,
                    "",
                    "",
                    _snap_name(snap if isinstance(snap, Mapping) else {}),
                    str(inv.tax_total),
                    "",
                    "",
                    "",
                    "",
                    inv.bill_to_kind.value,
                    inv.bill_to_email or "",
                    inv.bill_to_display_name or "",
                    inv.invoice_number or "",
                    "",
                    "",
                    # TODO: CSV invoice rows still emit record `created_at`; aligning this column
                    # with admin UI `invoice_date` is a product/export-schema decision (separate change).
                    inv.created_at.isoformat(),
                ]
            )
            for ln in lines_by_invoice.get(inv.id, []):
                w.writerow(
                    [
                        "2",
                        "invoice_line",
                        str(ln.id),
                        str(inv.id),
                        str(ln.line_total),
                        ln.currency,
                        "",
                        "",
                        (ln.description or "")[:200],
                        str(ln.tax_amount) if ln.tax_amount is not None else "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        inv.invoice_number or "",
                        str(ln.enrollment_id) if ln.enrollment_id else "",
                        str(ln.id),
                        ln.created_at.isoformat(),
                    ]
                )
        for r in receipts:
            w.writerow(
                [
                    "2",
                    "receipt",
                    str(r.id),
                    str(r.customer_payment_id),
                    str(r.total_amount),
                    r.currency,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    r.receipt_number,
                    "",
                    "",
                    r.created_at.isoformat(),
                ]
            )
        for a in allocs:
            w.writerow(
                [
                    "2",
                    "allocation",
                    str(a.id),
                    str(a.invoice_id),
                    str(a.allocated_amount),
                    a.currency,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    str(a.invoice_id),
                    "",
                    str(a.invoice_line_id) if a.invoice_line_id else "",
                    a.created_at.isoformat(),
                ]
            )

    return json_response(200, {"csv": buf.getvalue()}, event=event)
