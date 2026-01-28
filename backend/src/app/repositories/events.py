from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models import Event
from app.pagination import (
    encode_cursor,
    parse_cursor_datetime,
    parse_cursor_uuid,
)


def list_public_events(
    session: Session,
    limit: int,
    cursor: Optional[Dict[str, str]],
) -> Tuple[List[Dict[str, Optional[str]]], Optional[str]]:
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
                'starts_at': _isoformat(last_item.starts_at),
                'id': str(last_item.id),
            },
        )
        items = items[:limit]
    return [_serialize_event(item) for item in items], next_cursor


def _serialize_event(event: Event) -> Dict[str, Optional[str]]:
    starts_at = _isoformat(event.starts_at)
    ends_at = _isoformat(event.ends_at)
    return {
        'id': str(event.id),
        'title': event.title,
        'description': event.description,
        'location': event.location,
        'starts_at': starts_at,
        'ends_at': ends_at,
    }


def _isoformat(value) -> Optional[str]:
    if not value:
        return None
    return value.isoformat()
