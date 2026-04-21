"""Admin API handlers for notes on contacts (standalone, not tied to a sales lead)."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.api.admin_crm_helpers import crm_request_id
from app.api.admin_leads_common import serialize_note
from app.api.admin_request import parse_body
from app.api.admin_validators import MAX_DESCRIPTION_LENGTH, validate_string_length
from app.db.audit import set_audit_context
from app.db.engine import get_engine
from app.db.models.note import Note
from app.db.repositories import ContactRepository, NoteRepository
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response


def list_contact_notes(
    event: Mapping[str, Any],
    *,
    contact_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    """List standalone notes for a contact (newest first)."""
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        contact_repo = ContactRepository(session)
        if contact_repo.get_by_id_for_admin(contact_id) is None:
            raise NotFoundError("Contact", str(contact_id))
        note_repo = NoteRepository(session)
        notes = note_repo.list_standalone_for_contact(contact_id=contact_id)
        return json_response(
            200,
            {"items": [serialize_note(n) for n in notes]},
            event=event,
        )


def create_contact_note(
    event: Mapping[str, Any],
    *,
    contact_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    """Create a standalone note on a contact."""
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
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        contact_repo = ContactRepository(session)
        contact = contact_repo.get_by_id_for_admin(contact_id)
        if contact is None:
            raise NotFoundError("Contact", str(contact_id))

        note_repo = NoteRepository(session)
        note = note_repo.create(
            Note(
                contact_id=contact.id,
                lead_id=None,
                content=content,
                created_by=actor_sub,
            )
        )
        session.commit()
        return json_response(201, {"note": serialize_note(note)}, event=event)


def update_contact_note(
    event: Mapping[str, Any],
    *,
    contact_id: UUID,
    note_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    """Update a standalone note on a contact."""
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
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        contact_repo = ContactRepository(session)
        if contact_repo.get_by_id_for_admin(contact_id) is None:
            raise NotFoundError("Contact", str(contact_id))

        note_repo = NoteRepository(session)
        note = note_repo.get_standalone_for_contact(
            note_id=note_id, contact_id=contact_id
        )
        if note is None:
            raise NotFoundError("Note", str(note_id))

        note.content = content
        note.updated_at = datetime.now(UTC)
        note_repo.update(note)
        session.commit()
        return json_response(200, {"note": serialize_note(note)}, event=event)


def delete_contact_note(
    event: Mapping[str, Any],
    *,
    contact_id: UUID,
    note_id: UUID,
    actor_sub: str,
) -> dict[str, Any]:
    """Delete a standalone note on a contact."""
    with Session(get_engine()) as session:
        set_audit_context(session, user_id=actor_sub, request_id=crm_request_id(event))
        contact_repo = ContactRepository(session)
        if contact_repo.get_by_id_for_admin(contact_id) is None:
            raise NotFoundError("Contact", str(contact_id))

        note_repo = NoteRepository(session)
        note = note_repo.get_standalone_for_contact(
            note_id=note_id, contact_id=contact_id
        )
        if note is None:
            raise NotFoundError("Note", str(note_id))

        note_repo.delete(note)
        session.commit()
        return json_response(204, {}, event=event)
