# Free Guide Email Delivery + CRM Implementation Plan

## Status

**Approved for implementation.** This document is the authoritative
specification for an implementing agent.

## Goal

Replace the free guide's direct download link on the public website with a
lead capture form (first name + email). Deliver the guide via email through
Mailchimp automation. Store captured contacts in a new CRM schema. Notify
sales via SES.

The system must use SNS/SQS for fan-out and decoupling, Mailchimp for
marketing email delivery, and SES for internal sales notifications.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Alembic Migration](#3-alembic-migration)
4. [SQLAlchemy Models](#4-sqlalchemy-models)
5. [Repositories](#5-repositories)
6. [API Endpoint: Free Guide Request](#6-api-endpoint-free-guide-request)
7. [SNS/SQS Infrastructure (CDK)](#7-snssqs-infrastructure-cdk)
8. [Processor Lambda](#8-processor-lambda)
9. [Mailchimp Service](#9-mailchimp-service)
10. [Sales Notification Email Template](#10-sales-notification-email-template)
11. [Public Website: Form Component](#11-public-website-form-component)
12. [Public Website: Download Redirect Page](#12-public-website-download-redirect-page)
13. [Documentation Updates](#13-documentation-updates)
14. [Validation Checklist](#14-validation-checklist)
15. [Files to Create](#15-files-to-create)
16. [Files to Modify](#16-files-to-modify)
17. [Environment Variables and Secrets](#17-environment-variables-and-secrets)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  PUBLIC WEBSITE                                                  │
│                                                                  │
│  Free Guide Form (first_name + email + Turnstile)                │
│       │                                                          │
│       ▼                                                          │
│  POST /www/v1/free-guide-request                                 │
└──────┬───────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  API LAMBDA (synchronous path)                                   │
│                                                                  │
│  1. Validate Turnstile token                                     │
│  2. Validate input (first_name, email)                           │
│  3. Publish "free_guide_request.submitted" to SNS                │
│  4. Return 202 Accepted                                          │
└──────┬───────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  SNS TOPIC: "evolvesprouts-free-guide-events"                    │
│                                                                  │
│  Fan-out to SQS queue                                            │
└──────┬───────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  SQS QUEUE: "evolvesprouts-free-guide-queue"                     │
│  (DLQ: "evolvesprouts-free-guide-dlq", 3 retries, 14-day)       │
│                                                                  │
│  PROCESSOR LAMBDA: FreeGuideRequestProcessor                     │
│                                                                  │
│  Step 1: UPSERT contact in contacts table                        │
│  Step 2: INSERT sales_lead (idempotent)                          │
│  Step 3: INSERT sales_lead_event (type: created)                 │
│  Step 4: INSERT contact_tag ("free-guide-patience")              │
│  Step 5: Call Mailchimp API via http_invoke                      │
│  Step 6: INSERT sales_lead_event (type: email_sent)              │
│  Step 7: SES notification to sales/support                       │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼  (async, Mailchimp)
┌──────────────────────────────────────────────────────────────────┐
│  MAILCHIMP AUTOMATION                                            │
│  Trigger: tag "free-guide-patience" applied                      │
│  Sends: email with link to                                       │
│    https://www.evolvesprouts.com/guide/download?token=<token>    │
└──────────────────────────────────────────────────────────────────┘
```

### Asset share link and email delivery

The existing share link system at `/v1/assets/share/{token}` enforces a
domain allowlist by checking the `Referer`/`Origin` header. Email clients do
not send a matching `Referer`, so links clicked from email would receive 403.

**Solution:** Create a redirect landing page at
`/guide/download?token=<token>` on the public website. The email links to
this page. The page renders a brief "Preparing your download..." state and
then redirects to the actual share URL. The `Referer` is now
`www.evolvesprouts.com`, which is already in the allowlist. No changes to
the share link security model are needed.

---

## 2. Database Schema

### 2.1 New Enums

Create these PostgreSQL enums in the migration. Also add them to the Python
`enums.py` file.

```sql
CREATE TYPE contact_type AS ENUM (
  'parent', 'child', 'helper', 'professional', 'other'
);
CREATE TYPE contact_source AS ENUM (
  'free_guide', 'newsletter', 'contact_form', 'reservation',
  'referral', 'instagram', 'manual'
);
CREATE TYPE relationship_type AS ENUM (
  'prospect', 'client', 'past_client', 'partner', 'vendor', 'other'
);
CREATE TYPE mailchimp_sync_status AS ENUM (
  'pending', 'synced', 'failed', 'unsubscribed'
);
CREATE TYPE family_role AS ENUM (
  'parent', 'child', 'helper', 'guardian', 'other'
);
CREATE TYPE organization_type AS ENUM (
  'school', 'company', 'community_group', 'ngo', 'other'
);
CREATE TYPE organization_role AS ENUM (
  'admin', 'staff', 'teacher', 'member', 'client', 'partner', 'other'
);
CREATE TYPE lead_type AS ENUM (
  'free_guide', 'event_inquiry', 'program_enrollment',
  'consultation', 'partnership', 'other'
);
CREATE TYPE funnel_stage AS ENUM (
  'new', 'contacted', 'engaged', 'qualified', 'converted', 'lost'
);
CREATE TYPE lead_event_type AS ENUM (
  'created', 'stage_changed', 'note_added', 'email_sent',
  'email_opened', 'guide_downloaded', 'assigned', 'converted', 'lost'
);
```

### 2.2 Trigger Function

Create a reusable `set_updated_at()` trigger. Apply it to every table that
has an `updated_at` column.

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Table: `contacts`

```sql
CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(320),
    instagram_handle VARCHAR(30),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100),
    phone           VARCHAR(30),
    contact_type    contact_type NOT NULL,
    relationship_type relationship_type NOT NULL DEFAULT 'prospect',
    date_of_birth   DATE,
    location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
    source          contact_source NOT NULL,
    source_detail   TEXT,
    source_metadata JSONB,
    mailchimp_subscriber_id VARCHAR(64),
    mailchimp_status mailchimp_sync_status NOT NULL DEFAULT 'pending',
    archived_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contacts_email_unique_idx
    ON contacts (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX contacts_instagram_unique_idx
    ON contacts (lower(instagram_handle)) WHERE instagram_handle IS NOT NULL;
CREATE INDEX contacts_contact_type_idx ON contacts (contact_type);
CREATE INDEX contacts_relationship_type_idx ON contacts (relationship_type);
CREATE INDEX contacts_source_idx ON contacts (source);
CREATE INDEX contacts_archived_at_idx ON contacts (archived_at)
    WHERE archived_at IS NULL;

CREATE TRIGGER contacts_set_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 2.4 Table: `families`

```sql
CREATE TABLE families (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_name     VARCHAR(150) NOT NULL,
    relationship_type relationship_type NOT NULL DEFAULT 'prospect',
    location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
    archived_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX families_relationship_type_idx ON families (relationship_type);

CREATE TRIGGER families_set_updated_at
    BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 2.5 Table: `organizations`

```sql
CREATE TABLE organizations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    organization_type organization_type NOT NULL,
    relationship_type relationship_type NOT NULL DEFAULT 'prospect',
    website           VARCHAR(500),
    location_id       UUID REFERENCES locations(id) ON DELETE SET NULL,
    archived_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX organizations_type_idx ON organizations (organization_type);
CREATE INDEX organizations_relationship_type_idx
    ON organizations (relationship_type);

CREATE TRIGGER organizations_set_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 2.6 Table: `family_members`

```sql
CREATE TABLE family_members (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id          UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    contact_id         UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    role               family_role NOT NULL,
    is_primary_contact BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (family_id, contact_id)
);

CREATE INDEX family_members_contact_idx ON family_members (contact_id);
```

### 2.7 Table: `organization_members`

```sql
CREATE TABLE organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL
        REFERENCES contacts(id) ON DELETE CASCADE,
    role            organization_role NOT NULL,
    title           VARCHAR(150),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, contact_id)
);

CREATE INDEX organization_members_contact_idx
    ON organization_members (contact_id);
```

### 2.8 Table: `tags`

```sql
CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7),
    description VARCHAR(255),
    created_by  VARCHAR(128) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tags_name_unique_idx ON tags (lower(name));
```

### 2.9 Junction Tables: `contact_tags`, `family_tags`, `organization_tags`

```sql
CREATE TABLE contact_tags (
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE family_tags (
    family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (family_id, tag_id)
);

CREATE TABLE organization_tags (
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, tag_id)
);
```

### 2.10 Table: `crm_notes`

```sql
CREATE TABLE crm_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    family_id       UUID REFERENCES families(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    lead_id         UUID REFERENCES sales_leads(id) ON DELETE SET NULL,
    content         TEXT NOT NULL,
    created_by      VARCHAR(128) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_notes_has_parent CHECK (
        contact_id IS NOT NULL OR family_id IS NOT NULL
        OR organization_id IS NOT NULL OR lead_id IS NOT NULL
    )
);

CREATE INDEX crm_notes_contact_idx ON crm_notes (contact_id, created_at);
CREATE INDEX crm_notes_family_idx ON crm_notes (family_id, created_at);
CREATE INDEX crm_notes_lead_idx ON crm_notes (lead_id, created_at);

CREATE TRIGGER crm_notes_set_updated_at
    BEFORE UPDATE ON crm_notes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 2.11 Table: `sales_leads`

```sql
CREATE TABLE sales_leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    family_id       UUID REFERENCES families(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    lead_type       lead_type NOT NULL,
    funnel_stage    funnel_stage NOT NULL DEFAULT 'new',
    asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
    assigned_to     VARCHAR(128),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    converted_at    TIMESTAMPTZ,
    lost_at         TIMESTAMPTZ,
    lost_reason     TEXT,
    CONSTRAINT sales_leads_has_parent CHECK (
        contact_id IS NOT NULL OR family_id IS NOT NULL
        OR organization_id IS NOT NULL
    )
);

CREATE INDEX sales_leads_contact_idx ON sales_leads (contact_id);
CREATE INDEX sales_leads_family_idx ON sales_leads (family_id);
CREATE INDEX sales_leads_org_idx ON sales_leads (organization_id);
CREATE INDEX sales_leads_funnel_stage_idx ON sales_leads (funnel_stage);
CREATE UNIQUE INDEX sales_leads_guide_dedup_idx
    ON sales_leads (contact_id, lead_type, asset_id)
    WHERE asset_id IS NOT NULL;

CREATE TRIGGER sales_leads_set_updated_at
    BEFORE UPDATE ON sales_leads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 2.12 Table: `sales_lead_events`

```sql
CREATE TABLE sales_lead_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL
        REFERENCES sales_leads(id) ON DELETE CASCADE,
    event_type  lead_event_type NOT NULL,
    from_stage  funnel_stage,
    to_stage    funnel_stage,
    metadata    JSONB,
    created_by  VARCHAR(128),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sales_lead_events_lead_idx
    ON sales_lead_events (lead_id, created_at);
```

### 2.13 Table Creation Order

Tables must be created in this order to satisfy FK dependencies:

1. Enums (all 10)
2. Trigger function `set_updated_at()`
3. `contacts` (references `locations` which already exists)
4. `families` (references `locations`)
5. `organizations` (references `locations`)
6. `family_members` (references `contacts`, `families`)
7. `organization_members` (references `contacts`, `organizations`)
8. `tags`
9. `contact_tags` (references `contacts`, `tags`)
10. `family_tags` (references `families`, `tags`)
11. `organization_tags` (references `organizations`, `tags`)
12. `sales_leads` (references `contacts`, `families`, `organizations`,
    `assets`)
13. `crm_notes` (references `contacts`, `families`, `organizations`,
    `sales_leads`)
14. `sales_lead_events` (references `sales_leads`)

### 2.14 FK Cascade Policy

| FK | On Delete | Reason |
|----|-----------|--------|
| `family_members.contact_id` | CASCADE | Membership dies with contact |
| `family_members.family_id` | CASCADE | Membership dies with family |
| `organization_members.*` | CASCADE | Same |
| `contact_tags.*` | CASCADE | Tag assoc. dies with entity or tag |
| `family_tags.*` | CASCADE | Same |
| `organization_tags.*` | CASCADE | Same |
| `crm_notes.*` (all entity FKs) | SET NULL | Notes survive for audit |
| `sales_leads.*` (entity FKs) | SET NULL | Lead history survives |
| `sales_leads.asset_id` | SET NULL | Lead survives asset removal |
| `sales_lead_events.lead_id` | CASCADE | Events meaningless without lead |
| `contacts.location_id` | SET NULL | Contact survives location removal |
| `families.location_id` | SET NULL | Same |
| `organizations.location_id` | SET NULL | Same |

### 2.15 Seed Data Assessment

1. **Compatibility:** `backend/db/seed/seed_data.sql` contains no asset rows;
   no conflicts.
2. **NOT NULL columns:** All NOT NULL columns have defaults or are satisfied
   by the enum defaults. No seed insert needed.
3. **No renames/drops** of existing columns.
4. **New tables:** None require bootstrap rows.
5. **No enum changes** to existing enums.
6. **FK insert order:** New tables reference existing `locations` and `assets`
   tables only. No seed insert order change needed.

**Result:** No seed data updates required.

---

## 3. Alembic Migration

**File:** `backend/db/alembic/versions/0007_add_crm_tables.py`

- `revision = "0007_add_crm_tables"`
- `down_revision = "0006_drop_share_domain_default"`
- Use `op.execute()` for enum creation (PostgreSQL `CREATE TYPE`).
- Use `op.execute()` for the trigger function.
- Use `op.create_table()` for each table in the order above.
- Use `op.create_index()` for all indexes.
- Use `op.execute()` for `CREATE TRIGGER` statements.
- `downgrade()` must drop in reverse order: triggers, indexes, tables,
  trigger function, enums.

Follow the exact docstring/comment pattern from
`backend/db/alembic/versions/0004_add_asset_share_links.py`, including the
full seed-data assessment in the module docstring.

**Validation:** `echo -n "0007_add_crm_tables" | wc -c` = 19 chars (≤ 32).

---

## 4. SQLAlchemy Models

Follow the patterns in `backend/src/app/db/models/asset.py` and
`backend/src/app/db/models/ticket.py`.

### 4.1 Enums: `backend/src/app/db/models/enums.py`

Add these Python enums to the existing file:

```python
class ContactType(str, enum.Enum):
    PARENT = "parent"
    CHILD = "child"
    HELPER = "helper"
    PROFESSIONAL = "professional"
    OTHER = "other"

class ContactSource(str, enum.Enum):
    FREE_GUIDE = "free_guide"
    NEWSLETTER = "newsletter"
    CONTACT_FORM = "contact_form"
    RESERVATION = "reservation"
    REFERRAL = "referral"
    INSTAGRAM = "instagram"
    MANUAL = "manual"

class RelationshipType(str, enum.Enum):
    PROSPECT = "prospect"
    CLIENT = "client"
    PAST_CLIENT = "past_client"
    PARTNER = "partner"
    VENDOR = "vendor"
    OTHER = "other"

class MailchimpSyncStatus(str, enum.Enum):
    PENDING = "pending"
    SYNCED = "synced"
    FAILED = "failed"
    UNSUBSCRIBED = "unsubscribed"

class FamilyRole(str, enum.Enum):
    PARENT = "parent"
    CHILD = "child"
    HELPER = "helper"
    GUARDIAN = "guardian"
    OTHER = "other"

class OrganizationType(str, enum.Enum):
    SCHOOL = "school"
    COMPANY = "company"
    COMMUNITY_GROUP = "community_group"
    NGO = "ngo"
    OTHER = "other"

class OrganizationRole(str, enum.Enum):
    ADMIN = "admin"
    STAFF = "staff"
    TEACHER = "teacher"
    MEMBER = "member"
    CLIENT = "client"
    PARTNER = "partner"
    OTHER = "other"

class LeadType(str, enum.Enum):
    FREE_GUIDE = "free_guide"
    EVENT_INQUIRY = "event_inquiry"
    PROGRAM_ENROLLMENT = "program_enrollment"
    CONSULTATION = "consultation"
    PARTNERSHIP = "partnership"
    OTHER = "other"

class FunnelStage(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    ENGAGED = "engaged"
    QUALIFIED = "qualified"
    CONVERTED = "converted"
    LOST = "lost"

class LeadEventType(str, enum.Enum):
    CREATED = "created"
    STAGE_CHANGED = "stage_changed"
    NOTE_ADDED = "note_added"
    EMAIL_SENT = "email_sent"
    EMAIL_OPENED = "email_opened"
    GUIDE_DOWNLOADED = "guide_downloaded"
    ASSIGNED = "assigned"
    CONVERTED = "converted"
    LOST = "lost"
```

### 4.2 Model Files

Create one model file per entity, following the existing SQLAlchemy patterns:
- UUID PK with `server_default=text("gen_random_uuid()")`
- `TIMESTAMP(timezone=True)` with `server_default=text("now()")`
- Enum columns with `create_type=False` (enums created in migration)
- `values_callable` lambda for enum value extraction

**Files to create:**

| File | Classes |
|------|---------|
| `backend/src/app/db/models/contact.py` | `Contact` |
| `backend/src/app/db/models/family.py` | `Family`, `FamilyMember` |
| `backend/src/app/db/models/organization.py` | `Organization`, `OrganizationMember` |
| `backend/src/app/db/models/tag.py` | `Tag`, `ContactTag`, `FamilyTag`, `OrganizationTag` |
| `backend/src/app/db/models/crm_note.py` | `CrmNote` |
| `backend/src/app/db/models/sales_lead.py` | `SalesLead`, `SalesLeadEvent` |

Each model must:
- Use `from app.db.base import Base`
- Use `from app.db.models.enums import <relevant enums>`
- Define `__tablename__`
- Define `__table_args__` with indexes matching the migration
- Use `Mapped` type annotations matching the column types
- Include relationships where appropriate (e.g., `Contact.families` via
  `FamilyMember`)

### 4.3 Update `__init__.py`

**File:** `backend/src/app/db/models/__init__.py`

Add all new model imports and enum imports to the existing file. Add them to
`__all__`.

---

## 5. Repositories

### 5.1 `ContactRepository`

**File:** `backend/src/app/db/repositories/contact.py`

Extends `BaseRepository[Contact]`.

Key methods:

```python
def find_by_email(self, email: str) -> Contact | None:
    """Case-insensitive email lookup."""
    ...

def upsert_by_email(self, email: str, **fields) -> tuple[Contact, bool]:
    """Insert or update by email. Returns (contact, is_new)."""
    ...
```

The `upsert_by_email` method is critical for the processor Lambda. It must:
1. Query by `lower(email)`.
2. If found, update `first_name`, `source`, `source_detail` only if the
   existing values are less specific (do not overwrite a `manual` source
   with `free_guide`).
3. If not found, insert a new row.
4. Return the contact and a boolean indicating if it was newly created.

### 5.2 `SalesLeadRepository`

**File:** `backend/src/app/db/repositories/sales_lead.py`

Extends `BaseRepository[SalesLead]`.

Key methods:

```python
def find_by_contact_and_asset(
    self, contact_id: UUID, lead_type: LeadType, asset_id: UUID
) -> SalesLead | None:
    """Idempotency check for guide leads."""
    ...

def create_with_event(
    self, lead: SalesLead, event_type: LeadEventType, metadata: dict | None = None
) -> SalesLead:
    """Create lead and initial event in one transaction."""
    ...
```

### 5.3 Update `__init__.py`

**File:** `backend/src/app/db/repositories/__init__.py`

Add `ContactRepository` and `SalesLeadRepository` imports and `__all__`.

---

## 6. API Endpoint: Free Guide Request

### 6.1 Handler

**File:** `backend/src/app/api/public_free_guide.py`

This module handles `POST /v1/free-guide-request` (and
`POST /www/v1/free-guide-request` via the proxy).

```python
def handle_free_guide_request(
    event: Mapping[str, Any], method: str
) -> dict[str, Any]:
    """Handle free guide form submission."""
```

Logic:

1. Reject non-POST methods with 405.
2. Parse JSON body. Extract `first_name`, `email`,
   `turnstile_token`.
3. Validate `first_name`: required, 1–100 chars, sanitize.
4. Validate `email`: required, valid format, lowercase, ≤ 320 chars.
5. Validate Turnstile token using the existing pattern from
   `public_reservations.py`. If Turnstile verification fails, return 403.
6. Build the SNS message:
   ```json
   {
     "event_type": "free_guide_request.submitted",
     "first_name": "...",
     "email": "...",
     "submitted_at": "ISO-8601",
     "request_id": "lambda-request-id"
   }
   ```
7. Publish to SNS topic (`FREE_GUIDE_TOPIC_ARN` env var) using
   `get_sns_client().publish()`.
8. Return 202 with `{"message": "Request accepted"}`.

**Security:**
- Use `mask_email()` when logging the email.
- Never log the Turnstile token.
- Validate and sanitize all input.

### 6.2 Route Registration

**File:** `backend/src/app/api/admin.py`

Add two routes to the `_ROUTES` tuple:

```python
(
    "/v1/free-guide-request",
    True,
    lambda event, method, _path: handle_free_guide_request(event, method),
),
(
    "/www/v1/free-guide-request",
    True,
    lambda event, method, _path: handle_free_guide_request(event, method),
),
```

Import `handle_free_guide_request` from
`app.api.public_free_guide`.

### 6.3 API Gateway Route

In the CDK stack (`backend/infrastructure/lib/api-stack.ts`), add the route
to API Gateway. Follow the existing pattern for `/v1/reservations`.

### 6.4 Public WWW Proxy Allowlist

In `backend/infrastructure/lib/public-www-stack.ts`, add
`/www/v1/free-guide-request` to the proxy allowlist so the public website
can reach the endpoint via same-origin requests.

---

## 7. SNS/SQS Infrastructure (CDK)

**File:** `backend/infrastructure/lib/api-stack.ts`

Add a new section after the existing "Booking Request Messaging" block.
Reuse the same `sqsEncryptionKey`.

```typescript
// Free Guide Request Messaging (SNS + SQS)

const freeGuideDLQ = new sqs.Queue(this, "FreeGuideDLQ", {
  queueName: name("free-guide-dlq"),
  retentionPeriod: cdk.Duration.days(14),
  encryption: sqs.QueueEncryption.KMS,
  encryptionMasterKey: sqsEncryptionKey,
});

const freeGuideQueue = new sqs.Queue(this, "FreeGuideQueue", {
  queueName: name("free-guide-queue"),
  visibilityTimeout: cdk.Duration.seconds(60),
  deadLetterQueue: {
    queue: freeGuideDLQ,
    maxReceiveCount: 3,
  },
  encryption: sqs.QueueEncryption.KMS,
  encryptionMasterKey: sqsEncryptionKey,
});

const freeGuideTopic = new sns.Topic(this, "FreeGuideTopic", {
  topicName: name("free-guide-events"),
  masterKey: sqsEncryptionKey,
});

freeGuideTopic.addSubscription(
  new snsSubscriptions.SqsSubscription(freeGuideQueue)
);
```

### Processor Lambda

```typescript
const freeGuideProcessor = createPythonFunction(
  "FreeGuideRequestProcessor",
  {
    handler: "lambda/free_guide_processor/handler.lambda_handler",
    timeout: cdk.Duration.seconds(30),
    environment: {
      DATABASE_SECRET_ARN: database.adminUserSecret.secretArn,
      DATABASE_NAME: "evolvesprouts",
      DATABASE_USERNAME: "evolvesprouts_admin",
      DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
      DATABASE_IAM_AUTH: "true",
      SES_SENDER_EMAIL: sesSenderEmail.valueAsString,
      SUPPORT_EMAIL: supportEmail.valueAsString,
      MAILCHIMP_LIST_ID: mailchimpListId.valueAsString,
      MAILCHIMP_SERVER_PREFIX: mailchimpServerPrefix.valueAsString,
      MAILCHIMP_API_SECRET_ARN: mailchimpApiSecret.secretArn,
      FREE_GUIDE_TAG: "free-guide-patience",
      AWS_PROXY_FUNCTION_ARN: awsProxyFunction.functionArn,
    },
  }
);

database.grantAdminUserSecretRead(freeGuideProcessor);
database.grantConnect(freeGuideProcessor, "evolvesprouts_admin");

freeGuideProcessor.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: [sesSenderIdentityArn],
  })
);

freeGuideProcessor.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["secretsmanager:GetSecretValue"],
    resources: [mailchimpApiSecret.secretArn],
  })
);

awsProxyFunction.grantInvoke(freeGuideProcessor);

freeGuideProcessor.addEventSource(
  new lambdaEventSources.SqsEventSource(freeGuideQueue, {
    batchSize: 1,
  })
);
```

### Grant SNS publish to API Lambda

```typescript
freeGuideTopic.grantPublish(adminFunction);
// Add to adminFunction environment:
// FREE_GUIDE_TOPIC_ARN: freeGuideTopic.topicArn,
```

### DLQ Alarm

```typescript
new cdk.aws_cloudwatch.Alarm(this, "FreeGuideDLQAlarm", {
  alarmName: name("free-guide-dlq-alarm"),
  alarmDescription:
    "Free guide request messages failed processing and landed in DLQ",
  metric: freeGuideDLQ.metricApproximateNumberOfMessagesVisible({
    period: cdk.Duration.minutes(5),
  }),
  threshold: 1,
  evaluationPeriods: 1,
  treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
});
```

### CDK Parameters

Add these CDK parameters (using `noEcho: true` for secrets):

```typescript
const mailchimpApiSecret = new secretsmanager.Secret(
  this, "MailchimpApiSecret", {
    secretName: name("mailchimp-api-key"),
    description: "Mailchimp Marketing API key",
  }
);

const mailchimpListId = new cdk.CfnParameter(this, "MailchimpListId", {
  type: "String",
  description: "Mailchimp audience/list ID",
});

const mailchimpServerPrefix = new cdk.CfnParameter(
  this, "MailchimpServerPrefix", {
    type: "String",
    description: "Mailchimp API server prefix (e.g. us21)",
  }
);
```

### Stack Outputs

```typescript
new cdk.CfnOutput(this, "FreeGuideTopicArn", {
  value: freeGuideTopic.topicArn,
});
new cdk.CfnOutput(this, "FreeGuideQueueUrl", {
  value: freeGuideQueue.queueUrl,
});
new cdk.CfnOutput(this, "FreeGuideDLQUrl", {
  value: freeGuideDLQ.queueUrl,
});
```

### AWS Proxy Allow-list

Add the Mailchimp API URL prefix to the proxy's `ALLOWED_HTTP_URLS`
environment variable:

```
https://<server_prefix>.api.mailchimp.com/3.0/
```

Since `server_prefix` is a parameter, construct it dynamically in CDK.

---

## 8. Processor Lambda

**File:** `backend/lambda/free_guide_processor/handler.py`

Follow the exact patterns from
`backend/lambda/manager_request_processor/handler.py`.

### Handler Structure

```python
"""Lambda handler for processing free guide requests from SQS."""

from __future__ import annotations

import json
import os
from typing import Any

from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import (
    Contact, ContactSource, ContactType, FunnelStage,
    LeadEventType, LeadType, MailchimpSyncStatus, SalesLead,
    SalesLeadEvent,
)
from app.db.repositories.contact import ContactRepository
from app.db.repositories.sales_lead import SalesLeadRepository
from app.services.email import send_email
from app.services.mailchimp import add_subscriber_with_tag
from app.templates.free_guide_lead import render_sales_notification_email
from app.utils.logging import configure_logging, get_logger, mask_email
from app.utils.retry import run_with_retry

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    ...
```

### Processing Steps

For each SQS record:

1. **Parse message:** Extract SNS message from SQS body, parse JSON.
2. **Validate `event_type`:** Must be `"free_guide_request.submitted"`.
3. **UPSERT contact:**
   - Open a SQLAlchemy session.
   - Use `ContactRepository.upsert_by_email()`.
   - Set `contact_type=parent` (default for guide leads),
     `source=free_guide`, `source_detail` from message.
4. **INSERT sales_lead:**
   - Idempotency: check
     `SalesLeadRepository.find_by_contact_and_asset()`.
   - If exists, skip (already processed).
   - Create `SalesLead` with `lead_type=free_guide`,
     `funnel_stage=new`, `asset_id` from env var
     `FREE_GUIDE_ASSET_ID`.
5. **INSERT sales_lead_event:** `event_type=created`,
   `to_stage=new`.
6. **Ensure tag exists and apply:**
   - Look up `Tag` by name (`FREE_GUIDE_TAG` env var).
   - If not found, create it with `created_by="system"`.
   - Insert `ContactTag` row (ignore if exists via unique constraint).
7. **Call Mailchimp:**
   - Use `app.services.mailchimp.add_subscriber_with_tag()`.
   - On success, update `contact.mailchimp_status = synced`.
   - On failure, update `contact.mailchimp_status = failed`, log,
     but do not re-raise (Mailchimp failure should not block DB writes).
   - INSERT `SalesLeadEvent` with `event_type=email_sent`.
8. **Send SES sales notification:**
   - Render email via
     `app.templates.free_guide_lead.render_sales_notification_email()`.
   - Send via `send_email()` wrapped in `run_with_retry()`.
   - Best-effort: log failures, do not re-raise.
9. **Commit session.**

### Error Handling

- JSON parse errors: re-raise (SQS retry).
- DB errors: re-raise (SQS retry).
- Mailchimp errors: log, update `mailchimp_status`, continue.
- SES errors: log, continue.

---

## 9. Mailchimp Service

**File:** `backend/src/app/services/mailchimp.py`

```python
"""Mailchimp Marketing API integration via AWS proxy."""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any

from app.services.aws_clients import get_secretsmanager_client
from app.services.aws_proxy import http_invoke
from app.utils.logging import get_logger, mask_email

logger = get_logger(__name__)

_api_key_cache: str | None = None


def _get_api_key() -> str:
    """Retrieve Mailchimp API key from Secrets Manager (cached)."""
    global _api_key_cache
    if _api_key_cache is None:
        secret_arn = os.environ["MAILCHIMP_API_SECRET_ARN"]
        resp = get_secretsmanager_client().get_secret_value(
            SecretId=secret_arn
        )
        _api_key_cache = resp["SecretString"]
    return _api_key_cache


def _subscriber_hash(email: str) -> str:
    """MD5 hash of lowercase email (Mailchimp subscriber ID)."""
    return hashlib.md5(email.lower().encode()).hexdigest()


def add_subscriber_with_tag(
    email: str,
    first_name: str,
    tag_name: str,
) -> dict[str, Any]:
    """Add or update a Mailchimp subscriber and apply a tag.

    Uses PUT /3.0/lists/{list_id}/members/{hash} (idempotent upsert)
    and POST /3.0/lists/{list_id}/members/{hash}/tags.

    Calls are made via the AWS proxy Lambda (http_invoke) because
    in-VPC Lambdas cannot reach external HTTPS endpoints directly.

    Returns the Mailchimp API response body as a dict.
    Raises on non-2xx responses from the Mailchimp API.
    """
    api_key = _get_api_key()
    server = os.environ["MAILCHIMP_SERVER_PREFIX"]
    list_id = os.environ["MAILCHIMP_LIST_ID"]
    sub_hash = _subscriber_hash(email)
    base_url = f"https://{server}.api.mailchimp.com/3.0"

    # Step 1: Upsert subscriber
    member_url = f"{base_url}/lists/{list_id}/members/{sub_hash}"
    member_body = json.dumps({
        "email_address": email,
        "status_if_new": "subscribed",
        "merge_fields": {"FNAME": first_name},
    })
    auth_header = ... # Basic auth with "anystring:{api_key}"

    result = http_invoke(
        method="PUT",
        url=member_url,
        headers={
            "Authorization": f"Basic {_encode_auth(api_key)}",
            "Content-Type": "application/json",
        },
        body=member_body,
        timeout=15,
    )

    # Check status
    status = result.get("status", 500)
    if status >= 400:
        raise MailchimpApiError(status, result.get("body", ""))

    # Step 2: Apply tag
    tags_url = f"{base_url}/lists/{list_id}/members/{sub_hash}/tags"
    tags_body = json.dumps({
        "tags": [{"name": tag_name, "status": "active"}]
    })
    http_invoke(
        method="POST",
        url=tags_url,
        headers={
            "Authorization": f"Basic {_encode_auth(api_key)}",
            "Content-Type": "application/json",
        },
        body=tags_body,
        timeout=10,
    )

    return json.loads(result.get("body", "{}"))


def _encode_auth(api_key: str) -> str:
    """Encode Basic auth header value."""
    import base64
    return base64.b64encode(f"anystring:{api_key}".encode()).decode()


class MailchimpApiError(Exception):
    def __init__(self, status: int, body: str):
        self.status = status
        self.body = body
        super().__init__(f"Mailchimp API error {status}: {body}")
```

---

## 10. Sales Notification Email Template

**File:** `backend/src/app/templates/free_guide_lead.py`

Follow the pattern from `backend/src/app/templates/access_request.py`.

Create `render_sales_notification_email()` that returns `EmailContent` with:

- **Subject:** `[Evolve Sprouts] New Free Guide Lead: {first_name}`
- **Text body:** First name, masked email, guide name, submitted timestamp.
- **HTML body:** Styled table matching the existing template design.

Also update `backend/src/app/templates/__init__.py` to export the new
functions.

---

## 11. Public Website: Form Component

### 11.1 Free Guide Form

**File:** `apps/public_www/src/components/sections/free-guide-form.tsx`

A `'use client'` component that renders an inline or modal form with:

- First name input (required)
- Email input (required)
- Cloudflare Turnstile widget
- Submit button
- Loading state
- Success state ("Check your email for the download link!")
- Error state

Follow the patterns from `contact-us-form.tsx`:
- Use `createPublicCrmApiClient()` for API calls.
- POST to `/v1/free-guide-request`.
- Use `ServerSubmissionResult` for response handling.
- Validate email client-side with the same `EMAIL_PATTERN`.
- Sanitize inputs with the same sanitization functions.

### 11.2 Modify Free Resources Section

**File:** `apps/public_www/src/components/sections/free-resources-for-gentle-parenting.tsx`

Replace the `<SectionCtaAnchor href={ctaHref}>` in `ResourceCardContent`
with a button that triggers the form. The form can be rendered inline
below the checklist (replacing the CTA button) or as a modal.

Remove `ctaHref` from `ResourceCardContentProps`. Add callback prop for
form trigger.

### 11.3 Update Content Strings

**File:** `apps/public_www/src/content/en.json` (and `zh-CN.json`,
`zh-HK.json`)

- Remove or repurpose `ctaHref` from the resources content.
- Add form-related strings:
  - `formFirstNameLabel`
  - `formEmailLabel`
  - `formSubmitLabel` (e.g., "Send Me the Free Guide")
  - `formSuccessTitle` (e.g., "Check Your Email!")
  - `formSuccessBody`
  - `formErrorMessage`

---

## 12. Public Website: Download Redirect Page

**File:** `apps/public_www/src/app/guide/download/page.tsx`

A simple page that:

1. Reads `token` from the URL search params.
2. Validates the token format (24–128 chars, `[A-Za-z0-9_-]`).
3. Shows a branded "Preparing your download..." message with a spinner.
4. After a brief delay (500ms), redirects to
   `https://media.evolvesprouts.com/v1/assets/share/{token}`.
5. Shows a manual download link as fallback.
6. If no token or invalid token, shows an error state.

This page must be a client component (`'use client'`) because it reads
search params and performs a redirect.

The `media.evolvesprouts.com` base URL must come from an environment
variable (`NEXT_PUBLIC_ASSET_SHARE_BASE_URL`), not be hardcoded.

---

## 13. Documentation Updates

### 13.1 OpenAPI: `docs/api/public.yaml`

Add the `POST /www/v1/free-guide-request` endpoint:

- Request body: `first_name` (string, required), `email` (string, required),
  `turnstile_token` (string, required).
- Response 202: `{"message": "Request accepted"}`.
- Response 400: validation errors.
- Response 403: Turnstile verification failed.
- Response 405: method not allowed.

### 13.2 Lambda Catalog: `docs/architecture/lambdas.md`

Add entry for `FreeGuideRequestProcessor`:
- Trigger: SQS (`evolvesprouts-free-guide-queue`)
- Purpose: Process free guide lead captures
- Actions: DB upsert, Mailchimp sync, SES notification

### 13.3 Messaging: `docs/architecture/aws-messaging.md`

Add a new section documenting the free guide messaging flow, parallel to
the booking request section.

### 13.4 Database Schema: `docs/architecture/database-schema.md`

Add all new tables to the schema documentation.

### 13.5 AWS Assets Map: `docs/architecture/aws-assets-map.md`

Add new resources:
- `FreeGuideTopic` (SNS)
- `FreeGuideQueue` (SQS)
- `FreeGuideDLQ` (SQS)
- `FreeGuideRequestProcessor` (Lambda)
- `FreeGuideDLQAlarm` (CloudWatch)
- `MailchimpApiSecret` (Secrets Manager)
- Stack outputs: `FreeGuideTopicArn`, `FreeGuideQueueUrl`,
  `FreeGuideDLQUrl`

---

## 14. Validation Checklist

After implementation, verify:

- [ ] `echo -n "0007_add_crm_tables" | wc -c` ≤ 32
- [ ] `pre-commit run ruff-format --all-files` passes
- [ ] `bash scripts/validate-cursorrules.sh` passes
- [ ] Alembic migration applies cleanly (mentally trace
      `alembic upgrade head` then `psql -f seed_data.sql`)
- [ ] All new model files import from `app.db.base` and `app.db.models.enums`
- [ ] All new enums use `create_type=False` in SQLAlchemy (created in
      migration)
- [ ] No hardcoded secrets, API keys, domains, or environment-specific values
- [ ] All PII logging uses `mask_email()` / `mask_pii()`
- [ ] No `print()` statements in production code
- [ ] `get_logger()` used for all logging
- [ ] CDK `noEcho: true` on secret parameters
- [ ] No inline styles in JSX
- [ ] Public website tests added under `apps/public_www/tests/**`
- [ ] No `*.test.*` files under `apps/public_www/src/**`

---

## 15. Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `backend/db/alembic/versions/0007_add_crm_tables.py` | Migration |
| 2 | `backend/src/app/db/models/contact.py` | Contact model |
| 3 | `backend/src/app/db/models/family.py` | Family + FamilyMember models |
| 4 | `backend/src/app/db/models/organization.py` | Organization + OrganizationMember |
| 5 | `backend/src/app/db/models/tag.py` | Tag + junction models |
| 6 | `backend/src/app/db/models/crm_note.py` | CrmNote model |
| 7 | `backend/src/app/db/models/sales_lead.py` | SalesLead + SalesLeadEvent |
| 8 | `backend/src/app/db/repositories/contact.py` | ContactRepository |
| 9 | `backend/src/app/db/repositories/sales_lead.py` | SalesLeadRepository |
| 10 | `backend/src/app/api/public_free_guide.py` | API handler |
| 11 | `backend/lambda/free_guide_processor/handler.py` | Processor Lambda |
| 12 | `backend/src/app/services/mailchimp.py` | Mailchimp service |
| 13 | `backend/src/app/templates/free_guide_lead.py` | Email template |
| 14 | `apps/public_www/src/components/sections/free-guide-form.tsx` | Form component |
| 15 | `apps/public_www/src/app/guide/download/page.tsx` | Redirect page |
| 16 | `apps/public_www/tests/components/sections/free-guide-form.test.tsx` | Tests |

---

## 16. Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `backend/src/app/db/models/enums.py` | Add 10 new enum classes |
| 2 | `backend/src/app/db/models/__init__.py` | Export new models and enums |
| 3 | `backend/src/app/db/repositories/__init__.py` | Export new repositories |
| 4 | `backend/src/app/api/admin.py` | Add routes for `/v1/free-guide-request` and `/www/v1/free-guide-request` |
| 5 | `backend/src/app/templates/__init__.py` | Export new template functions |
| 6 | `backend/infrastructure/lib/api-stack.ts` | Add SNS/SQS/Lambda/route/params/outputs |
| 7 | `backend/infrastructure/lib/public-www-stack.ts` | Add `/www/v1/free-guide-request` to proxy allowlist |
| 8 | `apps/public_www/src/components/sections/free-resources-for-gentle-parenting.tsx` | Replace CTA link with form trigger |
| 9 | `apps/public_www/src/content/en.json` | Add form strings, remove ctaHref |
| 10 | `apps/public_www/src/content/zh-CN.json` | Same |
| 11 | `apps/public_www/src/content/zh-HK.json` | Same |
| 12 | `docs/api/public.yaml` | Add endpoint |
| 13 | `docs/architecture/lambdas.md` | Add processor Lambda |
| 14 | `docs/architecture/aws-messaging.md` | Add free guide messaging |
| 15 | `docs/architecture/database-schema.md` | Add CRM tables |
| 16 | `docs/architecture/aws-assets-map.md` | Add new AWS resources |

---

## 17. Environment Variables and Secrets

### API Lambda (additions)

| Variable | Source | Value |
|----------|--------|-------|
| `FREE_GUIDE_TOPIC_ARN` | CDK | SNS topic ARN |

### Processor Lambda

| Variable | Source | Value |
|----------|--------|-------|
| `DATABASE_SECRET_ARN` | CDK | DB credentials |
| `DATABASE_NAME` | CDK | `evolvesprouts` |
| `DATABASE_USERNAME` | CDK | `evolvesprouts_admin` |
| `DATABASE_PROXY_ENDPOINT` | CDK | RDS Proxy endpoint |
| `DATABASE_IAM_AUTH` | CDK | `true` |
| `SES_SENDER_EMAIL` | CDK param | Verified SES sender |
| `SUPPORT_EMAIL` | CDK param | Sales notification recipient |
| `MAILCHIMP_API_SECRET_ARN` | CDK | Secrets Manager ARN |
| `MAILCHIMP_LIST_ID` | CDK param | Audience ID |
| `MAILCHIMP_SERVER_PREFIX` | CDK param | e.g. `us21` |
| `FREE_GUIDE_TAG` | CDK | `free-guide-patience` |
| `FREE_GUIDE_ASSET_ID` | CDK param | UUID of the guide asset |
| `AWS_PROXY_FUNCTION_ARN` | CDK | Proxy Lambda ARN |

### Public Website (additions)

| Variable | Source | Value |
|----------|--------|-------|
| `NEXT_PUBLIC_ASSET_SHARE_BASE_URL` | Build-time env | `https://media.evolvesprouts.com` |

### Secrets Manager

| Secret | Value |
|--------|-------|
| `evolvesprouts-mailchimp-api-key` | Mailchimp API key |

---

## Deferred Items (tracked as GitHub issues)

These are out of scope for this implementation:

- [#413](../../issues/413) Full-text search on contacts
- [#414](../../issues/414) Contact deduplication strategy
- [#415](../../issues/415) Communication preferences
- [#416](../../issues/416) Activity and interaction log
- [#417](../../issues/417) Multi-location for organizations
