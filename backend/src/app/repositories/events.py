"""Event repository for database operations."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models import Event
from app.pagination import (
    encode_cursor,
    parse_cursor_datetime,
    parse_cursor_uuid,
)
from app.utils import isoformat


def list_public_events(
    session: Session,
    limit: int,
    cursor: Optional[Dict[str, Any]],
) -> Tuple[List[Dict[str, Optional[str]]], Optional[str]]:
    """List public events with cursor-based pagination.

    Args:
        session: SQLAlchemy database session.
        limit: Maximum number of events to return.
        cursor: Optional pagination cursor with 'starts_at' and 'id'.

    Returns:
        Tuple of (list of serialized events, next cursor or None).
    """
    query = session.query(Event).filter(Event.is_public.is_(True))
    if cursor:
        cursor_time = parse_cursor_datetime(cursor.get('starts_at'))
        cursor_id = parse_cursor_uuid(cursor.get('id'))
        query = query.filter(
            or_(
                Event.starts_at > cursor_time,
                and_(
                    Event.starts_at == cursor_time,
                    Event.id > cursor_id,
                ),
            ),
        )
    items = (
        query.order_by(Event.starts_at.asc(), Event.id.asc())
        .limit(limit + 1)
        .all()
    )
    next_cursor = None
    if len(items) > limit:
        last_item = items[limit - 1]
        next_cursor = encode_cursor(
            {
                'starts_at': isoformat(last_item.starts_at),
                'id': str(last_item.id),
            },
        )
        items = items[:limit]
    return [_serialize_event(item) for item in items], next_cursor


def _serialize_event(event: Event) -> Dict[str, Optional[str]]:
    """Serialize an Event model to a dictionary."""
    return {
        'id': str(event.id),
        'title': event.title,
        'description': event.description,
        'location': event.location,
        'starts_at': isoformat(event.starts_at),
        'ends_at': isoformat(event.ends_at),
    }
