"""Events service layer for business logic.

This module provides the interface between handlers and repositories,
managing database sessions and any business logic transformations.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.db import session_scope
from app.repositories.events import list_public_events


def get_public_events(
    limit: int,
    cursor: Optional[Dict[str, Any]],
) -> Tuple[List[Dict[str, Optional[str]]], Optional[str]]:
    """Retrieve paginated list of public events.

    Args:
        limit: Maximum number of events to return.
        cursor: Optional pagination cursor from previous response.

    Returns:
        Tuple of (list of serialized events, next cursor or None).

    Example:
        events, next_cursor = get_public_events(limit=10, cursor=None)
        # For next page:
        more_events, _ = get_public_events(limit=10, cursor={'...': '...'})
    """
    with session_scope() as session:
        return list_public_events(session, limit, cursor)
