"""Admin sales lead API handlers."""

from __future__ import annotations

import csv
import io
from collections.abc import Mapping
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_leads_common import (
    encode_lead_cursor,
    parse_create_lead_payload,
    parse_lead_filters,
    parse_optional_datetime,
    parse_update_lead_payload,
    request_id,
    serialize_lead_detail,
    serialize_lead_summary,
    serialize_note,
)
from app.api.admin_request import parse_body, parse_uuid, query_param
from app.api.admin_validators import MAX_DESCRIPTION_LENGTH, validate_string_length
from app.api.assets.assets_common import extract_identity, split_route_parts
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models import Contact, CrmNote
from app.db.models.enums import FunnelStage, LeadEventType
from app.db.repositories import ContactRepository, CrmNoteRepository, SalesLeadRepository
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response
from app.utils.responses import get_cors_headers, get_security_headers


def handle_admin_leads_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/leads routes."""
    parts = split_route_parts(path)
    if len(parts) < 2 or parts[0] != "admin" or parts[1] != "leads":
        return json_response(404, {"error": "Not found"}, event=event)

    identity = extract_identity(event)
    if not identity.user_sub:
        raise ValidationError("Authenticated user is required", field="authorization")

    if len(parts) == 2:
        if method == "GET":
            return _list_leads(event)
        if method == "POST":
            return _create_lead(event, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 3 and parts[2] == "analytics":
        if method != "GET":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _get_analytics(event)

    if len(parts) == 3 and parts[2] == "export":
        if method != "GET":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _export_leads(event)

    lead_id = parse_uuid(parts[2])
    if len(parts) == 3:
        if method == "GET":
            return _get_lead(event, lead_id=lead_id)
        if method == "PATCH":
            return _update_lead(event, lead_id=lead_id, actor_sub=identity.user_sub)
        return json_response(405, {"error": "Method not allowed"}, event=event)

    if len(parts) == 4 and parts[3] == "notes":
        if method != "POST":
            return json_response(405, {"error": "Method not allowed"}, event=event)
        return _create_lead_note(event, lead_id=lead_id, actor_sub=identity.user_sub)

    return json_response(404, {"error": "Not found"}, event=event)


def _list_leads(event: Mapping[str, Any]) -> dict[str, Any]:
    filters = parse_lead_filters(event)
    limit = filters["limit"]

    with Session(get_engine()) as session:
        repository = SalesLeadRepository(session)
        rows = repository.list_leads(
            limit=limit + 1,
            stage=filters["stage"],
            source=filters["source"],
            lead_type=filters["lead_type"],
            assigned_to=filters["assigned_to"],
            unassigned=filters["unassigned"],
            date_from=filters["date_from"],
            date_to=filters["date_to"],
            search=filters["search"],
            sort=filters["sort"],
            sort_dir=filters["sort_dir"],
            cursor_created_at=filters["cursor_created_at"],
            cursor_id=filters["cursor_id"],
        )
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        total_count = repository.count_leads(
            stage=filters["stage"],
            source=filters["source"],
            lead_type=filters["lead_type"],
            assigned_to=filters["assigned_to"],
            unassigned=filters["unassigned"],
            date_from=filters["date_from"],
            date_to=filters["date_to"],
            search=filters["search"],
        )
        next_cursor = None
        if has_more and page_rows and filters["sort"] == "created_at":
            next_cursor = encode_lead_cursor(page_rows[-1])
        return json_response(
            200,
            {
                "items": [serialize_lead_summary(lead) for lead in page_rows],
                "next_cursor": next_cursor,
                "total_count": total_count,
            },
            event=event,
        )


def _get_lead(event: Mapping[str, Any], *, lead_id: UUID) -> dict[str, Any]:
    with Session(get_engine()) as session:
        repository = SalesLeadRepository(session)
        lead = repository.get_by_id_with_details(lead_id)
        if lead is None:
            raise NotFoundError("SalesLead", str(lead_id))
        return json_response(
            200,
            {"lead": serialize_lead_detail(lead)},
            event=event,
        )


def _create_lead(event: Mapping[str, Any], *, actor_sub: str) -> dict[str, Any]:
    body = parse_body(event)
    payload = parse_create_lead_payload(body)

    with Session(get_engine()) as session:
        set_audit_context(
            session,
            user_id=actor_sub,
            request_id=request_id(event),
        )
        contact_repo = ContactRepository(session)
        lead_repo = SalesLeadRepository(session)
        note_repo = CrmNoteRepository(session)

        if payload["email"]:
            contact, _ = contact_repo.upsert_by_email(
                payload["email"],
                first_name=payload["first_name"],
                source=payload["source"],
                source_detail=payload["source_detail"],
                contact_type=payload["contact_type"],
            )
        else:
            contact = contact_repo.create(
                Contact(
                    first_name=payload["first_name"],
                    source=payload["source"],
                    source_detail=payload["source_detail"],
                    contact_type=payload["contact_type"],
                )
            )

        if payload["last_name"] is not None:
            contact.last_name = payload["last_name"]
        if payload["phone"] is not None:
            contact.phone = payload["phone"]
        if payload["instagram_handle"] is not None:
            contact.instagram_handle = payload["instagram_handle"]
        contact_repo.update(contact)

        lead = lead_repo.create_with_event(
            SalesLead(
                contact_id=contact.id,
                lead_type=payload["lead_type"],
                funnel_stage=FunnelStage.NEW,
                assigned_to=payload["assigned_to"],
            ),
            LeadEventType.CREATED,
            from_stage=None,
            to_stage=FunnelStage.NEW,
            created_by=actor_sub,
        )

        if payload["assigned_to"]:
            lead_repo.add_event(
                lead_id=lead.id,
                event_type=LeadEventType.ASSIGNED,
                metadata={"from": None, "to": payload["assigned_to"]},
                created_by=actor_sub,
            )

        if payload["note"]:
            note = note_repo.create(
                CrmNote(
                    contact_id=contact.id,
                    lead_id=lead.id,
                    content=payload["note"],
                    created_by=actor_sub,
                )
            )
            lead_repo.add_event(
                lead_id=lead.id,
                event_type=LeadEventType.NOTE_ADDED,
                metadata={"note_id": str(note.id)},
                created_by=actor_sub,
            )

        session.commit()
        created = lead_repo.get_by_id_with_details(lead.id)
        if created is None:
            raise NotFoundError("SalesLead", str(lead.id))
        return json_response(
            201,
            {"lead": serialize_lead_detail(created)},
            event=event,
        )


def _update_lead(
    event: Mapping[str, Any],
    *,
    lead_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    payload = parse_update_lead_payload(body)

    with Session(get_engine()) as session:
        set_audit_context(
            session,
            user_id=actor_sub,
            request_id=request_id(event),
        )
        repository = SalesLeadRepository(session)
        lead = repository.get_by_id_with_details(lead_id)
        if lead is None:
            raise NotFoundError("SalesLead", str(lead_id))

        if payload["funnel_stage"] is not None:
            previous = lead.funnel_stage
            next_stage = payload["funnel_stage"]
            if next_stage != previous:
                lead.funnel_stage = next_stage
                lead.updated_at = datetime.now(UTC)
                if next_stage == FunnelStage.CONVERTED:
                    lead.converted_at = datetime.now(UTC)
                    lead.lost_at = None
                    lead.lost_reason = None
                elif next_stage == FunnelStage.LOST:
                    lead.lost_at = datetime.now(UTC)
                    lead.lost_reason = payload["lost_reason"]
                    lead.converted_at = None
                else:
                    lead.converted_at = None
                    lead.lost_at = None
                    lead.lost_reason = None
                repository.update(lead)
                repository.add_event(
                    lead_id=lead.id,
                    event_type=LeadEventType.STAGE_CHANGED,
                    from_stage=previous,
                    to_stage=next_stage,
                    metadata=None,
                    created_by=actor_sub,
                )

        if payload["assigned_to_provided"]:
            previous_assignee = lead.assigned_to
            if previous_assignee != payload["assigned_to"]:
                lead.assigned_to = payload["assigned_to"]
                lead.updated_at = datetime.now(UTC)
                repository.update(lead)
                repository.add_event(
                    lead_id=lead.id,
                    event_type=LeadEventType.ASSIGNED,
                    metadata={"from": previous_assignee, "to": payload["assigned_to"]},
                    created_by=actor_sub,
                )

        session.commit()
        updated = repository.get_by_id_with_details(lead.id)
        if updated is None:
            raise NotFoundError("SalesLead", str(lead.id))
        return json_response(200, {"lead": serialize_lead_detail(updated)}, event=event)


def _create_lead_note(
    event: Mapping[str, Any],
    *,
    lead_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    body = parse_body(event)
    content = validate_string_length(
        body.get("content"),
        "content",
        max_length=MAX_DESCRIPTION_LENGTH,
        required=True,
    )
    if content is None:
        raise ValidationError("content is required", field="content")

    with Session(get_engine()) as session:
        set_audit_context(
            session,
            user_id=actor_sub,
            request_id=request_id(event),
        )
        lead_repo = SalesLeadRepository(session)
        lead = lead_repo.get_by_id(lead_id)
        if lead is None:
            raise NotFoundError("SalesLead", str(lead_id))

        note_repo = CrmNoteRepository(session)
        note = note_repo.create(
            CrmNote(
                lead_id=lead.id,
                contact_id=lead.contact_id,
                content=content,
                created_by=actor_sub,
            )
        )
        lead_repo.add_event(
            lead_id=lead.id,
            event_type=LeadEventType.NOTE_ADDED,
            metadata={"note_id": str(note.id)},
            created_by=actor_sub,
        )
        session.commit()
        return json_response(201, {"note": serialize_note(note)}, event=event)


def _get_analytics(event: Mapping[str, Any]) -> dict[str, Any]:
    date_from = parse_optional_datetime(query_param(event, "date_from"), "date_from")
    date_to = parse_optional_datetime(query_param(event, "date_to"), "date_to")

    with Session(get_engine()) as session:
        repository = SalesLeadRepository(session)
        base = repository.get_analytics(date_from=date_from, date_to=date_to)
        now = datetime.now(UTC)
        week_start = datetime.combine(
            (now - timedelta(days=now.weekday())).date(),
            datetime.min.time(),
            tzinfo=UTC,
        )
        month_start = datetime.combine(
            date(now.year, now.month, 1),
            datetime.min.time(),
            tzinfo=UTC,
        )
        leads_this_week = repository.count_leads(date_from=week_start)
        leads_this_month = repository.count_leads(date_from=month_start)
        funnel = base["funnel"]
        assert isinstance(funnel, dict)
        new_count = int(funnel.get(FunnelStage.NEW.value, 0))
        contacted_count = int(funnel.get(FunnelStage.CONTACTED.value, 0))
        engaged_count = int(funnel.get(FunnelStage.ENGAGED.value, 0))
        qualified_count = int(funnel.get(FunnelStage.QUALIFIED.value, 0))
        converted_count = int(funnel.get(FunnelStage.CONVERTED.value, 0))

        stage_conversion_rates = {
            "new_to_contacted": (contacted_count / new_count) if new_count else 0.0,
            "contacted_to_engaged": (engaged_count / contacted_count) if contacted_count else 0.0,
            "engaged_to_qualified": (qualified_count / engaged_count) if engaged_count else 0.0,
            "qualified_to_converted": (converted_count / qualified_count) if qualified_count else 0.0,
        }
        return json_response(
            200,
            {
                **base,
                "leads_this_week": leads_this_week,
                "leads_this_month": leads_this_month,
                "stage_conversion_rates": stage_conversion_rates,
                "avg_days_in_stage": {},
            },
            event=event,
        )


def _export_leads(event: Mapping[str, Any]) -> dict[str, Any]:
    filters = parse_lead_filters(event)
    with Session(get_engine()) as session:
        repository = SalesLeadRepository(session)
        rows = repository.list_leads(
            limit=5000,
            stage=filters["stage"],
            source=filters["source"],
            lead_type=filters["lead_type"],
            assigned_to=filters["assigned_to"],
            unassigned=filters["unassigned"],
            date_from=filters["date_from"],
            date_to=filters["date_to"],
            search=filters["search"],
            sort=filters["sort"],
            sort_dir=filters["sort_dir"],
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "ID",
                "First Name",
                "Last Name",
                "Email",
                "Phone",
                "Source",
                "Lead Type",
                "Stage",
                "Assigned To",
                "Created",
                "Last Activity",
                "Days In Stage",
                "Tags",
            ]
        )
        for lead in rows:
            summary = serialize_lead_summary(lead)
            contact = summary["contact"]
            writer.writerow(
                [
                    summary["id"],
                    contact["first_name"],
                    contact["last_name"],
                    contact["email"],
                    contact["phone"],
                    contact["source"],
                    summary["lead_type"],
                    summary["funnel_stage"],
                    summary["assigned_to"],
                    summary["created_at"],
                    summary["last_activity_at"],
                    summary["days_in_stage"],
                    ",".join(summary["tags"]),
                ]
            )

        filename = f"leads-export-{datetime.now(UTC).date().isoformat()}.csv"
        response_headers = {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": f'attachment; filename="{filename}"',
            **get_security_headers(),
            **get_cors_headers(event),
        }
        return {
            "statusCode": 200,
            "headers": response_headers,
            "body": output.getvalue(),
        }
