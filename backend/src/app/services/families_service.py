"""Families service layer for business logic.

This module provides the interface between handlers and repositories,
managing database sessions and any business logic transformations.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.db import session_scope
from app.repositories.families import list_families


def get_families(
    limit: int,
    cursor: Optional[Dict[str, Any]],
) -> Tuple[List[Dict[str, Optional[str]]], Optional[str]]:
    """Retrieve paginated list of families (admin only).

    Args:
        limit: Maximum number of families to return.
        cursor: Optional pagination cursor from previous response.

    Returns:
        Tuple of (list of serialized families, next cursor or None).

    Example:
        families, next_cursor = get_families(limit=20, cursor=None)
    """
    with session_scope() as session:
        return list_families(session, limit, cursor)
