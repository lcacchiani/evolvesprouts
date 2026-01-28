"""Family repository for database operations."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models import Family
from app.pagination import (
    encode_cursor,
    parse_cursor_datetime,
    parse_cursor_uuid,
)
from app.utils import isoformat


def list_families(
    session: Session,
    limit: int,
    cursor: Optional[Dict[str, Any]],
) -> Tuple[List[Dict[str, Optional[str]]], Optional[str]]:
    """List families with cursor-based pagination.

    Args:
        session: SQLAlchemy database session.
        limit: Maximum number of families to return.
        cursor: Optional pagination cursor with 'created_at' and 'id'.

    Returns:
        Tuple of (list of serialized families, next cursor or None).
    """
    query = session.query(Family)
    if cursor:
        cursor_time = parse_cursor_datetime(cursor.get('created_at'))
        cursor_id = parse_cursor_uuid(cursor.get('id'))
        query = query.filter(
            or_(
                Family.created_at < cursor_time,
                and_(
                    Family.created_at == cursor_time,
                    Family.id < cursor_id,
                ),
            ),
        )
    items = (
        query.order_by(Family.created_at.desc(), Family.id.desc())
        .limit(limit + 1)
        .all()
    )
    next_cursor = None
    if len(items) > limit:
        last_item = items[limit - 1]
        next_cursor = encode_cursor(
            {
                'created_at': isoformat(last_item.created_at),
                'id': str(last_item.id),
            },
        )
        items = items[:limit]
    return [_serialize_family(item) for item in items], next_cursor


def _serialize_family(family: Family) -> Dict[str, Optional[str]]:
    """Serialize a Family model to a dictionary."""
    return {
        'id': str(family.id),
        'name': family.name,
        'primary_email': family.primary_email,
        'created_at': isoformat(family.created_at),
    }
