"""Cursor-based pagination utilities.

This module provides reusable cursor pagination for database queries,
supporting multiple sort orders and key types.
"""

from __future__ import annotations

import base64
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Generic, List, Optional, Tuple, TypeVar
from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Query, Session

from app.errors import bad_request

# Type variable for model classes
T = TypeVar('T')


def decode_cursor(raw_cursor: Optional[str]) -> Optional[Dict[str, Any]]:
    """Decode a base64url-encoded cursor string to a dictionary.

    Args:
        raw_cursor: Base64url-encoded cursor string, or None.

    Returns:
        Decoded cursor payload dictionary, or None if input is None.

    Raises:
        ApiError: If cursor is malformed (400 bad_request).
    """
    if not raw_cursor:
        return None
    try:
        padded = _pad_base64(raw_cursor)
        decoded = base64.urlsafe_b64decode(padded.encode('utf-8'))
        payload = json.loads(decoded.decode('utf-8'))
    except (ValueError, json.JSONDecodeError) as exc:
        raise bad_request('invalid_cursor') from exc
    if not isinstance(payload, dict):
        raise bad_request('invalid_cursor')
    return payload


def encode_cursor(payload: Dict[str, Any]) -> str:
    """Encode a dictionary to a base64url cursor string.

    Args:
        payload: Dictionary to encode as cursor.

    Returns:
        Base64url-encoded cursor string (without padding).
    """
    encoded = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    return base64.urlsafe_b64encode(encoded).decode('utf-8').rstrip('=')


def parse_cursor_datetime(value: Optional[str]) -> datetime:
    """Parse an ISO 8601 datetime string from a cursor.

    Args:
        value: ISO 8601 datetime string.

    Returns:
        Datetime with timezone info (defaults to UTC if not specified).

    Raises:
        ApiError: If value is None or invalid format (400 bad_request).
    """
    if not value:
        raise bad_request('invalid_cursor')
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise bad_request('invalid_cursor') from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def parse_cursor_uuid(value: Optional[str]) -> UUID:
    """Parse a UUID string from a cursor.

    Args:
        value: UUID string.

    Returns:
        UUID object.

    Raises:
        ApiError: If value is None or invalid format (400 bad_request).
    """
    if not value:
        raise bad_request('invalid_cursor')
    try:
        return UUID(value)
    except ValueError as exc:
        raise bad_request('invalid_cursor') from exc


def _pad_base64(value: str) -> str:
    """Add padding to base64url string."""
    padding = '=' * (-len(value) % 4)
    return f'{value}{padding}'


# ---------------------------------------------------------------------------
# Reusable Paginator Base Class
# ---------------------------------------------------------------------------


@dataclass
class PaginatedResult(Generic[T]):
    """Result of a paginated query.

    Attributes:
        items: List of items for the current page.
        next_cursor: Cursor string for the next page, or None if no more pages.
        has_more: True if there are more items after this page.
    """

    items: List[T]
    next_cursor: Optional[str]
    has_more: bool


class CursorPaginator(ABC, Generic[T]):
    """Abstract base class for cursor-based pagination.

    Subclasses define the sort keys and how to build cursor payloads.
    This class handles the common pagination logic.

    Example:
        class EventPaginator(CursorPaginator[Event]):
            sort_key = 'starts_at'
            sort_order = 'asc'

            def get_cursor_values(self, item: Event) -> Dict[str, Any]:
                return {
                    'starts_at': isoformat(item.starts_at),
                    'id': str(item.id),
                }

            def apply_cursor_filter(self, query, cursor):
                cursor_time = parse_cursor_datetime(cursor.get('starts_at'))
                cursor_id = parse_cursor_uuid(cursor.get('id'))
                return query.filter(
                    or_(
                        Event.starts_at > cursor_time,
                        and_(Event.starts_at == cursor_time, Event.id > cursor_id),
                    )
                )
    """

    @abstractmethod
    def get_cursor_values(self, item: T) -> Dict[str, Any]:
        """Extract cursor values from an item.

        Args:
            item: The model instance to extract values from.

        Returns:
            Dictionary with cursor key-value pairs.
        """
        pass

    @abstractmethod
    def apply_cursor_filter(
        self,
        query: Query,
        cursor: Dict[str, Any],
    ) -> Query:
        """Apply cursor filter to a query.

        Args:
            query: SQLAlchemy query to filter.
            cursor: Decoded cursor dictionary.

        Returns:
            Filtered query.
        """
        pass

    @abstractmethod
    def apply_ordering(self, query: Query) -> Query:
        """Apply sort ordering to a query.

        Args:
            query: SQLAlchemy query to order.

        Returns:
            Ordered query.
        """
        pass

    def paginate(
        self,
        query: Query,
        limit: int,
        cursor: Optional[Dict[str, Any]] = None,
    ) -> PaginatedResult[T]:
        """Execute a paginated query.

        Args:
            query: Base SQLAlchemy query (with any filters already applied).
            limit: Maximum number of items to return.
            cursor: Optional decoded cursor dictionary.

        Returns:
            PaginatedResult with items, next_cursor, and has_more flag.
        """
        if cursor:
            query = self.apply_cursor_filter(query, cursor)

        query = self.apply_ordering(query)

        # Fetch one extra item to detect if there are more pages
        items = query.limit(limit + 1).all()

        has_more = len(items) > limit
        if has_more:
            items = items[:limit]

        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = encode_cursor(self.get_cursor_values(last_item))

        return PaginatedResult(
            items=items,
            next_cursor=next_cursor,
            has_more=has_more,
        )


def paginate_query(
    query: Query,
    limit: int,
    cursor: Optional[Dict[str, Any]],
    *,
    cursor_filter_fn: Callable[[Query, Dict[str, Any]], Query],
    ordering_fn: Callable[[Query], Query],
    cursor_values_fn: Callable[[T], Dict[str, Any]],
) -> PaginatedResult[T]:
    """Functional pagination helper for simpler use cases.

    Args:
        query: Base SQLAlchemy query.
        limit: Maximum items to return.
        cursor: Optional decoded cursor dictionary.
        cursor_filter_fn: Function to apply cursor filter to query.
        ordering_fn: Function to apply ordering to query.
        cursor_values_fn: Function to extract cursor values from an item.

    Returns:
        PaginatedResult with items, next_cursor, and has_more flag.
    """
    if cursor:
        query = cursor_filter_fn(query, cursor)

    query = ordering_fn(query)
    items = query.limit(limit + 1).all()

    has_more = len(items) > limit
    if has_more:
        items = items[:limit]

    next_cursor = None
    if has_more and items:
        last_item = items[-1]
        next_cursor = encode_cursor(cursor_values_fn(last_item))

    return PaginatedResult(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more,
    )
