"""Admin expense API handlers."""

from __future__ import annotations

from datetime import UTC, datetime
import json
import os
from typing import Any
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_expenses_common import (
    _STATUS_TERMINAL,
    apply_common_fields,
    parse_create_payload,
    parse_optional_parse_status,
    parse_optional_status,
    parse_optional_string,
    parse_update_payload,
    required_string,
    resolve_asset_ids,
    serialize_expense,
)
from app.api.admin_request import (
    encode_cursor,
    parse_body,
    parse_cursor,
    parse_uuid,
    query_param,
)
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import ExpenseParseStatus, ExpenseStatus
from app.db.repositories import ExpenseRepository
from app.exceptions import NotFoundError, ValidationError
from app.services.aws_clients import get_sns_client
from app.utils import json_response
from app.utils.logging import get_logger

logger = get_logger(__name__)

_DEFAULT_LIMIT = 25
_MAX_LIMIT = 100
_EVENT_TYPE_PARSE_REQUESTED = "expense.parse_requested"


def handle_admin_expenses_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/expenses routes."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "expenses":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method == "GET":
            return _list_expenses(event)
        if method == "POST":
            return _create_expense(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    expense_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_expense(event, expense_id=expense_id)
        if method == "PATCH":
            return _update_expense(
                event, expense_id=expense_id, actor_sub=identity.user_sub
            )
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 4 and parts[3] == "cancel":
        if method != "POST":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _cancel_expense(
            event, expense_id=expense_id, actor_sub=identity.user_sub
        )

    if len(parts) == 4 and parts[3] == "mark-paid":
        if method != "POST":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _mark_expense_paid(
            event, expense_id=expense_id, actor_sub=identity.user_sub
        )

    if len(parts) == 4 and parts[3] == "reparse":
        if method != "POST":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _reparse_expense(
            event, expense_id=expense_id, actor_sub=identity.user_sub
        )

    if len(parts) == 4 and parts[3] == "amend":
        if method != "POST":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _amend_expense(event, expense_id=expense_id, actor_sub=identity.user_sub)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_expenses(event: Mapping[str, Any]) -> dict[str, Any]:
    limit = _parse_limit(event)
    cursor = parse_cursor(query_param(event, "cursor"))
    query = parse_optional_string(query_param(event, "query"), max_length=255)
    status = parse_optional_status(query_param(event, "status"))
    parse_status = parse_optional_parse_status(query_param(event, "parse_status"))
    logger.info("Listing expenses", extra={"limit": limit})

    with Session(get_engine()) as session:
        repository = ExpenseRepository(session)
        expenses = repository.list_expenses(
            limit=limit + 1,
            cursor=cursor,
            query=query,
            status=status,
            parse_status=parse_status,
        )
        has_more = len(expenses) > limit
        page_items = expenses[:limit]
        next_cursor = (
            encode_cursor(page_items[-1].id) if has_more and page_items else None
        )
        total_count = repository.count_expenses(
            query=query,
            status=status,
            parse_status=parse_status,
        )
        return json_response(
            200,
            {
                "items": [serialize_expense(expense) for expense in page_items],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _create_expense(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    logger.info("Creating expense", extra={"actor": actor_sub})
    payload = parse_create_payload(parse_body(event))
    request_id = _request_id(event)
    now = datetime.now(UTC)
    parse_status = (
        ExpenseParseStatus.QUEUED
        if payload["parse_requested"]
        else ExpenseParseStatus.NOT_REQUESTED
    )

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id)
        expense_repo = ExpenseRepository(session)
        expense = expense_repo.create_expense(
            created_by=actor_sub,
            status=payload["status"],
            parse_status=parse_status,
            vendor_name=payload["vendor_name"],
            invoice_number=payload["invoice_number"],
            invoice_date=payload["invoice_date"],
            due_date=payload["due_date"],
            currency=payload["currency"],
            subtotal=payload["subtotal"],
            tax=payload["tax"],
            total=payload["total"],
            line_items=payload["line_items"],
            notes=payload["notes"],
        )
        if payload["status"] == ExpenseStatus.SUBMITTED:
            expense.submitted_at = now

        asset_ids = resolve_asset_ids(session, payload["attachment_asset_ids"])
        expense_repo.replace_attachments(expense, asset_ids)
        session.commit()

        if payload["parse_requested"]:
            _enqueue_parse(expense.id)

        refreshed = expense_repo.get_with_attachments(expense.id)
        if refreshed is None:
            raise NotFoundError("Expense", str(expense.id))
        return json_response(
            201, {"expense": serialize_expense(refreshed)}, event=event
        )


def _get_expense(event: Mapping[str, Any], *, expense_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = ExpenseRepository(session)
        expense = repository.get_with_attachments(expense_id)
        if expense is None:
            raise NotFoundError("Expense", str(expense_id))
        return json_response(200, {"expense": serialize_expense(expense)}, event=event)


def _update_expense(
    event: Mapping[str, Any],
    *,
    expense_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    logger.info(
        "Updating expense",
        extra={"expense_id": str(expense_id), "actor": actor_sub},
    )
    payload = parse_update_payload(parse_body(event))
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id)
        expense_repo = ExpenseRepository(session)
        expense = expense_repo.get_with_attachments(expense_id)
        if expense is None:
            raise NotFoundError("Expense", str(expense_id))
        if expense.status in _STATUS_TERMINAL:
            raise ValidationError(
                "Terminal expenses cannot be edited directly. Create an amendment instead.",
                field="status",
            )

        apply_common_fields(expense, payload)
        if payload["status"] is not None and payload["status"] != expense.status:
            expense.status = payload["status"]
            if (
                expense.status == ExpenseStatus.SUBMITTED
                and expense.submitted_at is None
            ):
                expense.submitted_at = datetime.now(UTC)

        if payload["attachment_asset_ids"] is not None:
            asset_ids = resolve_asset_ids(session, payload["attachment_asset_ids"])
            expense_repo.replace_attachments(expense, asset_ids)

        expense.updated_by = actor_sub
        expense_repo.update(expense)
        session.commit()
        refreshed = expense_repo.get_with_attachments(expense_id)
        if refreshed is None:
            raise NotFoundError("Expense", str(expense_id))
        return json_response(
            200, {"expense": serialize_expense(refreshed)}, event=event
        )


def _cancel_expense(
    event: Mapping[str, Any],
    *,
    expense_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    logger.info(
        "Voiding expense",
        extra={"expense_id": str(expense_id), "actor": actor_sub},
    )
    body = parse_body(event)
    reason = required_string(body, "reason", max_length=2000)
    request_id = _request_id(event)
    now = datetime.now(UTC)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id)
        repository = ExpenseRepository(session)
        expense = repository.get_with_attachments(expense_id)
        if expense is None:
            raise NotFoundError("Expense", str(expense_id))
        if expense.status != ExpenseStatus.VOIDED:
            expense.status = ExpenseStatus.VOIDED
            expense.void_reason = reason
            expense.voided_at = now
            expense.updated_by = actor_sub
            repository.update(expense)
            session.commit()
        return json_response(200, {"expense": serialize_expense(expense)}, event=event)


def _mark_expense_paid(
    event: Mapping[str, Any],
    *,
    expense_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    logger.info(
        "Marking expense paid",
        extra={"expense_id": str(expense_id), "actor": actor_sub},
    )
    request_id = _request_id(event)
    now = datetime.now(UTC)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id)
        repository = ExpenseRepository(session)
        expense = repository.get_with_attachments(expense_id)
        if expense is None:
            raise NotFoundError("Expense", str(expense_id))
        if expense.status == ExpenseStatus.VOIDED:
            raise ValidationError(
                "Voided expenses cannot be marked paid", field="status"
            )
        expense.status = ExpenseStatus.PAID
        expense.paid_at = now
        expense.updated_by = actor_sub
        repository.update(expense)
        session.commit()
        return json_response(200, {"expense": serialize_expense(expense)}, event=event)


def _reparse_expense(
    event: Mapping[str, Any],
    *,
    expense_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    logger.info(
        "Requeueing expense parse",
        extra={"expense_id": str(expense_id), "actor": actor_sub},
    )
    request_id = _request_id(event)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id)
        repository = ExpenseRepository(session)
        expense = repository.get_with_attachments(expense_id)
        if expense is None:
            raise NotFoundError("Expense", str(expense_id))
        if not expense.attachments:
            raise ValidationError(
                "At least one attachment is required before parsing",
                field="attachments",
            )
        expense.parse_status = ExpenseParseStatus.QUEUED
        expense.updated_by = actor_sub
        repository.update(expense)
        session.commit()

    _enqueue_parse(expense_id)
    return json_response(202, {"message": "Parse request accepted"}, event=event)


def _amend_expense(
    event: Mapping[str, Any],
    *,
    expense_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    logger.info(
        "Creating expense amendment",
        extra={"source_expense_id": str(expense_id), "actor": actor_sub},
    )
    payload = parse_update_payload(parse_body(event))
    request_id = _request_id(event)
    now = datetime.now(UTC)

    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=request_id)
        expense_repo = ExpenseRepository(session)
        source = expense_repo.get_with_attachments(expense_id)
        if source is None:
            raise NotFoundError("Expense", str(expense_id))
        if source.status == ExpenseStatus.VOIDED:
            raise ValidationError("Voided expenses cannot be amended", field="status")

        amendment = expense_repo.create_expense(
            created_by=actor_sub,
            status=payload["status"] or ExpenseStatus.DRAFT,
            parse_status=(
                ExpenseParseStatus.QUEUED
                if payload["parse_requested"]
                else ExpenseParseStatus.NOT_REQUESTED
            ),
            amends_expense_id=source.id,
            vendor_name=source.vendor_name,
            invoice_number=source.invoice_number,
            invoice_date=source.invoice_date,
            due_date=source.due_date,
            currency=source.currency,
            subtotal=source.subtotal,
            tax=source.tax,
            total=source.total,
            line_items=source.line_items,
            notes=source.notes,
        )
        apply_common_fields(amendment, payload)
        if amendment.status == ExpenseStatus.SUBMITTED:
            amendment.submitted_at = now

        if payload["attachment_asset_ids"] is not None:
            asset_ids = resolve_asset_ids(session, payload["attachment_asset_ids"])
        else:
            asset_ids = [attachment.asset_id for attachment in source.attachments]
        expense_repo.replace_attachments(amendment, asset_ids)

        source.status = ExpenseStatus.AMENDED
        source.updated_by = actor_sub
        expense_repo.update(source)
        expense_repo.update(amendment)
        session.commit()

        if payload["parse_requested"]:
            _enqueue_parse(amendment.id)
        refreshed = expense_repo.get_with_attachments(amendment.id)
        if refreshed is None:
            raise NotFoundError("Expense", str(amendment.id))
        return json_response(
            201, {"expense": serialize_expense(refreshed)}, event=event
        )


def _enqueue_parse(expense_id: UUID) -> None:
    topic_arn = os.getenv("EXPENSE_PARSE_TOPIC_ARN", "").strip()
    if not topic_arn:
        raise ValidationError(
            "Expense parser topic is not configured", field="configuration"
        )
    get_sns_client().publish(
        TopicArn=topic_arn,
        Message=json.dumps(
            {
                "event_type": _EVENT_TYPE_PARSE_REQUESTED,
                "expense_id": str(expense_id),
                "requested_at": datetime.now(UTC).isoformat(),
            }
        ),
        MessageAttributes={
            "event_type": {
                "DataType": "String",
                "StringValue": _EVENT_TYPE_PARSE_REQUESTED,
            }
        },
    )


def _parse_limit(event: Mapping[str, Any]) -> int:
    raw = query_param(event, "limit")
    if raw is None or raw == "":
        return _DEFAULT_LIMIT
    try:
        parsed = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError("limit must be an integer", field="limit") from exc
    if parsed < 1 or parsed > _MAX_LIMIT:
        raise ValidationError("limit must be between 1 and 100", field="limit")
    return parsed


def _request_id(event: Mapping[str, Any]) -> str:
    request_context = event.get("requestContext")
    if isinstance(request_context, Mapping):
        request_id = request_context.get("requestId")
        if isinstance(request_id, str):
            return request_id.strip()
    return ""
