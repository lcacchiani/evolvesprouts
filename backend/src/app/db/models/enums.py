"""Enum definitions for database models."""

from __future__ import annotations

import enum


class PricingType(str, enum.Enum):
    """Supported pricing types for activities."""

    PER_CLASS = "per_class"
    PER_SESSIONS = "per_sessions"
    PER_HOUR = "per_hour"
    PER_DAY = "per_day"
    FREE = "free"


class ScheduleType(str, enum.Enum):
    """Supported schedule types for activities."""

    WEEKLY = "weekly"


class TicketType(str, enum.Enum):
    """Discriminator for ticket types."""

    ACCESS_REQUEST = "access_request"
    ORGANIZATION_SUGGESTION = "organization_suggestion"
    ORGANIZATION_FEEDBACK = "organization_feedback"


class TicketStatus(str, enum.Enum):
    """Lifecycle status for tickets."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AssetType(str, enum.Enum):
    """Supported client asset categories."""

    GUIDE = "guide"
    VIDEO = "video"
    PDF = "pdf"
    DOCUMENT = "document"


class AssetVisibility(str, enum.Enum):
    """Asset visibility level."""

    PUBLIC = "public"
    RESTRICTED = "restricted"


class AccessGrantType(str, enum.Enum):
    """Scope of access grant for restricted assets."""

    ALL_AUTHENTICATED = "all_authenticated"
    ORGANIZATION = "organization"
    USER = "user"
