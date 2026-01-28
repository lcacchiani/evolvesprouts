from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import Event


def list_public_events(
    session: Session,
    limit: int,
) -> List[Dict[str, Optional[str]]]:
    events = (
        session.query(Event)
        .filter(Event.is_public.is_(True))
        .order_by(Event.starts_at.asc())
        .limit(limit)
        .all()
    )
    return [_serialize_event(item) for item in events]


def _serialize_event(event: Event) -> Dict[str, Optional[str]]:
    starts_at = None
    if event.starts_at:
        starts_at = event.starts_at.isoformat()
    ends_at = None
    if event.ends_at:
        ends_at = event.ends_at.isoformat()
    return {
        'id': str(event.id),
        'title': event.title,
        'description': event.description,
        'location': event.location,
        'starts_at': starts_at,
        'ends_at': ends_at,
    }
