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
    WHATSAPP = "whatsapp"
    LINKEDIN = "linkedin"
    EVENT = "event"
    PHONE_CALL = "phone_call"
    PUBLIC_WEBSITE = "public_website"
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


class ServiceType(str, enum.Enum):
    """Discriminator for service categories."""

    TRAINING_COURSE = "training_course"
    EVENT = "event"
    CONSULTATION = "consultation"


class ServiceStatus(str, enum.Enum):
    """Lifecycle status for a service template."""

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ServiceDeliveryMode(str, enum.Enum):
    """Delivery mode for service templates and instances."""

    ONLINE = "online"
    IN_PERSON = "in_person"
    HYBRID = "hybrid"


class TrainingFormat(str, enum.Enum):
    """Training delivery format."""

    GROUP = "group"
    PRIVATE = "private"


class TrainingPricingUnit(str, enum.Enum):
    """Training pricing granularity."""

    PER_PERSON = "per_person"
    PER_FAMILY = "per_family"


class EventCategory(str, enum.Enum):
    """Event categorization."""

    WORKSHOP = "workshop"
    WEBINAR = "webinar"
    OPEN_HOUSE = "open_house"
    COMMUNITY_MEETUP = "community_meetup"
    OTHER = "other"


class ConsultationFormat(str, enum.Enum):
    """Consultation delivery format."""

    ONE_ON_ONE = "one_on_one"
    GROUP = "group"


class ConsultationPricingModel(str, enum.Enum):
    """Consultation pricing model."""

    FREE = "free"
    HOURLY = "hourly"
    PACKAGE = "package"


class InstanceStatus(str, enum.Enum):
    """Lifecycle status for a service instance."""

    SCHEDULED = "scheduled"
    OPEN = "open"
    FULL = "full"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class EventbriteSyncStatus(str, enum.Enum):
    """Sync lifecycle status for Eventbrite publishing."""

    PENDING = "pending"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"


class DiscountType(str, enum.Enum):
    """Discount code type."""

    PERCENTAGE = "percentage"
    ABSOLUTE = "absolute"


class EnrollmentStatus(str, enum.Enum):
    """Lifecycle status for enrollments."""

    REGISTERED = "registered"
    WAITLISTED = "waitlisted"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ExpenseStatus(str, enum.Enum):
    """Lifecycle status for admin-managed expense invoices."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    PAID = "paid"
    VOIDED = "voided"
    AMENDED = "amended"


class ExpenseParseStatus(str, enum.Enum):
    """Parsing lifecycle status for invoice extraction."""

    NOT_REQUESTED = "not_requested"
    QUEUED = "queued"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class InboundEmailStatus(str, enum.Enum):
    """Processing lifecycle for inbound email ingestion records."""

    RECEIVED = "received"
    PROCESSING = "processing"
    STORED = "stored"
    SKIPPED = "skipped"
    FAILED = "failed"
