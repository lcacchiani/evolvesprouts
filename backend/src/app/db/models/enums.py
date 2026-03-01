"""Enum definitions for database models."""

from __future__ import annotations

import enum


class TicketType(str, enum.Enum):
    """Discriminator for ticket types."""

    ACCESS_REQUEST = "access_request"
    ORGANIZATION_SUGGESTION = "organization_suggestion"


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


class ContactType(str, enum.Enum):
    """Contact category for CRM records."""

    PARENT = "parent"
    CHILD = "child"
    HELPER = "helper"
    PROFESSIONAL = "professional"
    OTHER = "other"


class ContactSource(str, enum.Enum):
    """Primary source channel for a contact."""

    FREE_GUIDE = "free_guide"
    NEWSLETTER = "newsletter"
    CONTACT_FORM = "contact_form"
    RESERVATION = "reservation"
    REFERRAL = "referral"
    INSTAGRAM = "instagram"
    MANUAL = "manual"


class RelationshipType(str, enum.Enum):
    """Lifecycle relationship type for contacts/orgs/families."""

    PROSPECT = "prospect"
    CLIENT = "client"
    PAST_CLIENT = "past_client"
    PARTNER = "partner"
    VENDOR = "vendor"
    OTHER = "other"


class MailchimpSyncStatus(str, enum.Enum):
    """Sync status with Mailchimp."""

    PENDING = "pending"
    SYNCED = "synced"
    FAILED = "failed"
    UNSUBSCRIBED = "unsubscribed"


class FamilyRole(str, enum.Enum):
    """Role of a contact within a family."""

    PARENT = "parent"
    CHILD = "child"
    HELPER = "helper"
    GUARDIAN = "guardian"
    OTHER = "other"


class OrganizationType(str, enum.Enum):
    """Organization classification."""

    SCHOOL = "school"
    COMPANY = "company"
    COMMUNITY_GROUP = "community_group"
    NGO = "ngo"
    OTHER = "other"


class OrganizationRole(str, enum.Enum):
    """Role of a contact in an organization."""

    ADMIN = "admin"
    STAFF = "staff"
    TEACHER = "teacher"
    MEMBER = "member"
    CLIENT = "client"
    PARTNER = "partner"
    OTHER = "other"


class LeadType(str, enum.Enum):
    """Sales lead origin/type."""

    FREE_GUIDE = "free_guide"
    EVENT_INQUIRY = "event_inquiry"
    PROGRAM_ENROLLMENT = "program_enrollment"
    CONSULTATION = "consultation"
    PARTNERSHIP = "partnership"
    OTHER = "other"


class FunnelStage(str, enum.Enum):
    """Sales funnel stage."""

    NEW = "new"
    CONTACTED = "contacted"
    ENGAGED = "engaged"
    QUALIFIED = "qualified"
    CONVERTED = "converted"
    LOST = "lost"


class LeadEventType(str, enum.Enum):
    """Lead lifecycle event type."""

    CREATED = "created"
    STAGE_CHANGED = "stage_changed"
    NOTE_ADDED = "note_added"
    EMAIL_SENT = "email_sent"
    EMAIL_OPENED = "email_opened"
    GUIDE_DOWNLOADED = "guide_downloaded"
    ASSIGNED = "assigned"
    CONVERTED = "converted"
    LOST = "lost"
