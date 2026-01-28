"""Shared utility functions for the backend application."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID


def isoformat(value: Optional[datetime]) -> Optional[str]:
    """Convert a datetime to ISO 8601 string format.

    Args:
        value: A datetime object or None.

    Returns:
        ISO 8601 formatted string or None if input is None.
    """
    if value is None:
        return None
    return value.isoformat()


def serialize_uuid(value: Optional[UUID]) -> Optional[str]:
    """Convert a UUID to string format.

    Args:
        value: A UUID object or None.

    Returns:
        String representation of UUID or None if input is None.
    """
    if value is None:
        return None
    return str(value)


def safe_str(value: Any) -> Optional[str]:
    """Safely convert a value to string.

    Args:
        value: Any value that can be converted to string, or None.

    Returns:
        String representation or None if input is None/empty.
    """
    if value is None:
        return None
    result = str(value)
    return result if result else None
