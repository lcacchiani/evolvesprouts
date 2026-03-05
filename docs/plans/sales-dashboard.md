# Sales Dashboard — Implementation Plan

> **Status:** Approved for development
> **Scope:** Full-stack feature — database migration, backend API, admin web UI
> **Branch:** `cursor/sales-dashboard-leads-funnel-4183`

---

## Table of contents

1. [Context and goals](#1-context-and-goals)
2. [Design decisions](#2-design-decisions)
3. [Database migration](#3-database-migration)
4. [Backend API endpoints](#4-backend-api-endpoints)
5. [CDK route wiring](#5-cdk-route-wiring)
6. [Admin web — types and API layer](#6-admin-web--types-and-api-layer)
7. [Admin web — hooks](#7-admin-web--hooks)
8. [Admin web — UI components](#8-admin-web--ui-components)
9. [Documentation updates](#9-documentation-updates)
10. [Testing](#10-testing)
11. [Implementation sequence](#11-implementation-sequence)
12. [Appendices](#appendices)

---

## 1. Context and goals

### What exists

| Layer | Status |
|-------|--------|
| **Database tables** | `contacts`, `sales_leads`, `sales_lead_events`, `crm_notes` — all created in migration `0007_add_crm_tables` |
| **Enums** | `FunnelStage` (new → contacted → engaged → qualified → converted → lost), `LeadType`, `LeadEventType`, `ContactSource`, `ContactType`, `RelationshipType` |
| **Models** | `SalesLead`, `SalesLeadEvent`, `CrmNote`, `Contact` in `backend/src/app/db/models/` |
| **Repositories** | `SalesLeadRepository` (find by contact+asset, create with event), `ContactRepository` (find/upsert by email) |
| **Lead capture** | `POST /www/v1/media-request` → SNS → SQS → `MediaRequestProcessor` Lambda creates contacts and leads |
| **Admin web** | `AppShell` with one nav item ("Client assets"), UI primitives (`Button`, `Card`, `Input`, `Select`, `ConfirmDialog`, `StatusBanner`), `adminApiRequest` fetch wrapper, Tailwind v4 slate palette |
| **Admin users** | Cognito user pool with `admin` and `manager` groups. AWS proxy Lambda supports `cognito-idp:list_users`. No admin endpoint to list users yet. |

### What is missing

- No admin API endpoints for leads, contacts, notes, or admin users
- No admin web pages, hooks, or components for sales
- No charting library
- `ContactSource` enum lacks channels: WhatsApp, LinkedIn, phone call, event, public website
- `assigned_to` on `sales_leads` is `varchar(128)` — needs to store Cognito `sub` (UUID) for the admin user picker

### Goals

Build a sales dashboard that enables the team to:

1. See all leads in a funnel view with counts per stage
2. Filter, sort, and search leads by stage, source, assignee, date range, lead type
3. View lead detail with contact info, activity timeline, and notes
4. Advance or regress leads through funnel stages (bidirectional)
5. Assign/reassign leads to admin users (Cognito user picker)
6. Add notes and log activities
7. Create leads manually from any source channel
8. Send emails via `mailto:` links
9. Export filtered leads as CSV
10. View analytics with configurable date ranges

---

## 2. Design decisions

### 2.1 Assignee model

`assigned_to` stores the Cognito user `sub` (UUID string). A new `GET /v1/admin/users` endpoint lists admin-group Cognito users (email + sub) via the AWS proxy. The frontend fetches this list for a dropdown picker and for resolving `sub` → display name throughout the UI.

### 2.2 Stage transitions

Bidirectional. Any stage can transition to any other stage, including backward (e.g., `qualified` → `engaged`). `lost` is reachable from any stage and a lead can be re-opened from `lost` to any active stage. Every transition creates a `SalesLeadEvent` with `from_stage` and `to_stage`. A `lost_reason` is **required** when transitioning to `lost`.

### 2.3 Lead creation

Leads can be created:
- **Automatically** via the existing `MediaRequestProcessor` (free guide capture)
- **Manually** via a new `POST /v1/admin/leads` endpoint from the dashboard

Manual creation requires: `first_name`, `email` (optional — some channels like phone/WhatsApp may not have it), `source`, `lead_type`, and optionally `phone`, `assigned_to`, `source_detail`.

### 2.4 Contact source expansion

New sources to add via Alembic migration: `whatsapp`, `linkedin`, `event`, `phone_call`, `public_website`.

### 2.5 Email action

"Send email" opens a `mailto:` link with the contact's email pre-filled.

### 2.6 Refresh strategy

Manual refresh via a "Refresh" button. No polling.

### 2.7 Analytics date ranges

All analytics endpoints accept `date_from` and `date_to` query parameters (ISO 8601 date strings). Frontend provides preset ranges (today, this week, this month, this quarter, this year, all time) and a custom date picker.

### 2.8 Duplicate detection

When creating a lead manually, if the contact email matches an existing contact, upsert into the existing contact (reuse `ContactRepository.upsert_by_email`). If a lead already exists for the same contact + lead_type (and no asset), warn but allow creation (different inquiry types from the same person are valid).

### 2.9 Lead aging

The leads table shows "days in current stage" calculated from the last `stage_changed` event (or `created_at` if still `new`). Leads sitting longer than a configurable threshold (default: 7 days) get a visual warning indicator.

### 2.10 Charting library

Add `recharts` (React charting library, ~45 KB gzipped, good Tailwind compatibility) to `apps/admin_web`. Used for the funnel chart, source breakdown, and analytics charts.

---

## 3. Database migration

### Migration: `0008_expand_crm_enums`

**File:** `backend/db/alembic/versions/0008_expand_crm_enums.py`

**Changes:**

Add new values to the `contact_source` PostgreSQL enum type:

```sql
ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'linkedin';
ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'phone_call';
ALTER TYPE contact_source ADD VALUE IF NOT EXISTS 'public_website';
```

**Python enum update** (`backend/src/app/db/models/enums.py`):

Add to `ContactSource`:

```python
WHATSAPP = "whatsapp"
LINKEDIN = "linkedin"
EVENT = "event"
PHONE_CALL = "phone_call"
PUBLIC_WEBSITE = "public_website"
```

**Seed data:** No seed update needed — no rows reference these new enum values yet, and the enum expansion is purely additive.

**Validation:**
- `echo -n "0008_expand_crm_enums" | wc -c` → 22 characters (≤ 32 limit)
- Enum additions are forward-only in PostgreSQL (no downgrade for `ADD VALUE`)
- Existing `ContactSource` references (`FREE_GUIDE`, `NEWSLETTER`, etc.) are unchanged

---

## 4. Backend API endpoints

All new endpoints live under `/v1/admin/` and require the `adminAuthorizer` (Cognito `admin` group).

### 4.1 `GET /v1/admin/users`

**File:** `backend/src/app/api/admin_users.py` (new)

**Purpose:** List admin-group Cognito users for the assignee picker.

**Implementation:**
- Call `aws_proxy.invoke("cognito-idp", "list_users", {"UserPoolId": ..., "Filter": ...})` to list users
- Call `aws_proxy.invoke("cognito-idp", "admin_list_groups_for_user", ...)` to filter by `admin` group, OR use the Cognito `ListUsersInGroup` API (needs to be added to proxy allow-list)
- Return `{ "items": [{ "sub": "...", "email": "...", "name": "..." }] }`

**Note:** The `ALLOWED_ACTIONS` env var on the proxy Lambda must include `cognito-idp:list_users_in_group` if that API is used. Update `backend/infrastructure/lib/api-stack.ts` accordingly.

**Request helpers (reuse):** `extract_identity`, `json_response` from existing patterns.

**Environment:** Needs `USER_POOL_ID` env var on the admin Lambda (already available from CDK).

### 4.2 `GET /v1/admin/leads`

**File:** `backend/src/app/api/admin_leads.py` (new)

**Purpose:** List leads with filtering, sorting, and cursor pagination.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | 1–100 |
| `cursor` | string | null | Opaque cursor for pagination |
| `stage` | string | null | Filter by `funnel_stage` (comma-separated for multiple) |
| `source` | string | null | Filter by contact `source` (comma-separated) |
| `lead_type` | string | null | Filter by `lead_type` (comma-separated) |
| `assigned_to` | string | null | Filter by `assigned_to` (Cognito sub) |
| `unassigned` | boolean | false | If true, only return unassigned leads |
| `date_from` | string | null | ISO 8601 date — filter `created_at >=` |
| `date_to` | string | null | ISO 8601 date — filter `created_at <=` |
| `search` | string | null | Search contact `first_name`, `last_name`, `email` (ILIKE) |
| `sort` | string | `created_at` | Sort field: `created_at`, `updated_at`, `funnel_stage`, `contact_name` |
| `sort_dir` | string | `desc` | `asc` or `desc` |

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "contact": {
        "id": "uuid",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@example.com",
        "phone": "+852...",
        "instagram_handle": "@jane",
        "source": "free_guide",
        "source_detail": "parenting-guide-q1",
        "contact_type": "parent",
        "relationship_type": "prospect"
      },
      "lead_type": "free_guide",
      "funnel_stage": "new",
      "assigned_to": "cognito-sub-uuid",
      "created_at": "2026-03-01T10:00:00Z",
      "updated_at": "2026-03-02T14:30:00Z",
      "converted_at": null,
      "lost_at": null,
      "lost_reason": null,
      "days_in_stage": 4,
      "last_activity_at": "2026-03-02T14:30:00Z",
      "tags": ["parenting-guide", "hong-kong"]
    }
  ],
  "next_cursor": "opaque-string-or-null",
  "total_count": 142
}
```

**Repository changes** (`backend/src/app/db/repositories/sales_lead.py`):

Add method `list_leads(...)` with:
- JOINs to `contacts` for contact fields and search
- JOINs to `sales_lead_events` for `last_activity_at` (MAX `created_at`)
- Stage duration calculation: days since last `stage_changed` event or `sales_leads.created_at`
- Cursor-based pagination on `(created_at, id)` for stable ordering
- `total_count` via a separate `COUNT(*)` query with the same filters (skip if expensive — can make optional via `include_count=true` query param)

### 4.3 `GET /v1/admin/leads/{id}`

**Purpose:** Single lead detail with full contact info, events timeline, and notes.

**Response:**

```json
{
  "lead": {
    "id": "uuid",
    "contact": { /* full contact object */ },
    "family": null,
    "organization": null,
    "lead_type": "free_guide",
    "funnel_stage": "contacted",
    "asset_id": null,
    "assigned_to": "cognito-sub-uuid",
    "created_at": "...",
    "updated_at": "...",
    "converted_at": null,
    "lost_at": null,
    "lost_reason": null,
    "days_in_stage": 3,
    "events": [
      {
        "id": "uuid",
        "event_type": "created",
        "from_stage": null,
        "to_stage": "new",
        "metadata": null,
        "created_by": "cognito-sub",
        "created_at": "2026-03-01T10:00:00Z"
      },
      {
        "id": "uuid",
        "event_type": "stage_changed",
        "from_stage": "new",
        "to_stage": "contacted",
        "metadata": { "note": "Called and left voicemail" },
        "created_by": "cognito-sub",
        "created_at": "2026-03-02T14:30:00Z"
      }
    ],
    "notes": [
      {
        "id": "uuid",
        "content": "Interested in summer program, will follow up next week",
        "created_by": "cognito-sub",
        "created_at": "2026-03-02T14:35:00Z"
      }
    ],
    "tags": ["parenting-guide"]
  }
}
```

**Repository:** Eager-load `events` (ordered by `created_at` desc), `crm_notes` (ordered by `created_at` desc), `contact` with `tags`.

### 4.4 `POST /v1/admin/leads`

**Purpose:** Manually create a lead from any source channel.

**Request body:**

```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+85291234567",
  "instagram_handle": "@janedoe",
  "source": "whatsapp",
  "source_detail": "Messaged about summer camps",
  "lead_type": "consultation",
  "contact_type": "parent",
  "assigned_to": "cognito-sub-uuid",
  "note": "Initial WhatsApp inquiry about summer programs"
}
```

**Required fields:** `first_name`, `source`, `lead_type`

**Optional fields:** All others. `email` is optional because some channels (phone calls, WhatsApp without email) may not have it.

**Logic:**
1. If `email` is provided, use `ContactRepository.upsert_by_email()` to find or create contact
2. If `email` is not provided, create a new `Contact` (no dedup possible without email)
3. Create `SalesLead` with `funnel_stage=new`
4. Create `SalesLeadEvent` with `event_type=created`
5. If `note` is provided, create a `CrmNote` attached to the lead
6. If `assigned_to` is provided, create a `SalesLeadEvent` with `event_type=assigned`

**Response:** 201 with the full lead object (same shape as GET `/v1/admin/leads/{id}`)

### 4.5 `PATCH /v1/admin/leads/{id}`

**Purpose:** Update lead stage, assignee, or lost reason.

**Request body (all optional):**

```json
{
  "funnel_stage": "contacted",
  "assigned_to": "cognito-sub-uuid",
  "lost_reason": "Budget constraints"
}
```

**Validation:**
- If `funnel_stage` is `lost`, `lost_reason` is required
- If transitioning away from `lost`, clear `lost_at` and `lost_reason`
- If transitioning to `converted`, set `converted_at`
- If transitioning away from `converted`, clear `converted_at`

**Side effects for stage change:**
1. Update `sales_leads.funnel_stage`, `updated_at`
2. Set/clear `converted_at` or `lost_at`+`lost_reason` as appropriate
3. Create `SalesLeadEvent` (`stage_changed`, with `from_stage`/`to_stage`)
4. Caller identity (`sub` from JWT) recorded as `created_by`

**Side effects for assignee change:**
1. Update `sales_leads.assigned_to`, `updated_at`
2. Create `SalesLeadEvent` (`assigned`, with metadata `{"from": "old-sub", "to": "new-sub"}`)

**Response:** 200 with the full lead object

### 4.6 `POST /v1/admin/leads/{id}/notes`

**Purpose:** Add a note to a lead.

**Request body:**

```json
{
  "content": "Spoke with Jane on the phone. She's interested in the summer program."
}
```

**Logic:**
1. Validate lead exists
2. Create `CrmNote` with `lead_id` and `contact_id` (from the lead's contact)
3. Create `SalesLeadEvent` (`note_added`, metadata `{"note_id": "..."}`)
4. Record caller identity as `created_by`

**Response:** 201 with the note object

### 4.7 `GET /v1/admin/leads/analytics`

**Purpose:** Aggregated analytics for the funnel dashboard.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date_from` | string | null | ISO 8601 date |
| `date_to` | string | null | ISO 8601 date |

**Response:**

```json
{
  "funnel": {
    "new": 45,
    "contacted": 32,
    "engaged": 18,
    "qualified": 8,
    "converted": 12,
    "lost": 25
  },
  "conversion_rate": 0.085,
  "avg_days_to_convert": 14.2,
  "leads_this_week": 12,
  "leads_this_month": 38,
  "source_breakdown": {
    "free_guide": 42,
    "whatsapp": 18,
    "instagram": 15,
    "referral": 12,
    "phone_call": 8,
    "event": 6,
    "newsletter": 5,
    "linkedin": 4,
    "public_website": 3,
    "contact_form": 2,
    "manual": 1,
    "reservation": 0
  },
  "stage_conversion_rates": {
    "new_to_contacted": 0.71,
    "contacted_to_engaged": 0.56,
    "engaged_to_qualified": 0.44,
    "qualified_to_converted": 0.60
  },
  "avg_days_in_stage": {
    "new": 2.1,
    "contacted": 3.4,
    "engaged": 5.2,
    "qualified": 3.8
  },
  "leads_over_time": [
    { "period": "2026-W09", "count": 8 },
    { "period": "2026-W10", "count": 12 }
  ],
  "assignee_stats": [
    {
      "assigned_to": "cognito-sub",
      "total": 25,
      "converted": 8,
      "conversion_rate": 0.32,
      "avg_days_to_convert": 11.5
    }
  ]
}
```

**Implementation notes:**
- `funnel` counts: `SELECT funnel_stage, COUNT(*) FROM sales_leads WHERE ... GROUP BY funnel_stage`
- `conversion_rate`: converted / (total - lost) within date range
- `avg_days_to_convert`: `AVG(converted_at - created_at)` for converted leads
- `source_breakdown`: JOIN `contacts`, `GROUP BY source`
- `stage_conversion_rates`: count leads that reached stage N+1 / count that reached stage N (using `sales_lead_events` history)
- `avg_days_in_stage`: average time between consecutive `stage_changed` events per stage
- `leads_over_time`: `GROUP BY date_trunc('week', created_at)` with date range filter
- `assignee_stats`: `GROUP BY assigned_to` with conversion metrics

**Repository:** Add method `get_analytics(date_from, date_to)` that runs these aggregate queries. Keep them as separate focused queries to allow independent optimization.

### 4.8 `GET /v1/admin/leads/export`

**Purpose:** CSV export of filtered leads.

**Query parameters:** Same as `GET /v1/admin/leads` (minus `limit`/`cursor`).

**Response:** `Content-Type: text/csv` with `Content-Disposition: attachment; filename="leads-export-2026-03-05.csv"`

**Columns:** ID, First Name, Last Name, Email, Phone, Source, Lead Type, Stage, Assigned To, Created, Last Activity, Days in Stage, Tags

**Implementation note:** Stream rows to avoid memory issues at scale. Use the same repository query as the list endpoint but without pagination.

---

## 5. CDK route wiring

**File:** `backend/infrastructure/lib/api-stack.ts`

Add after the existing `adminLocations` block (around line 2073):

```typescript
// Admin lead routes
const adminLeads = admin.addResource("leads");
adminLeads.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminLeads.addMethod("POST", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminLeadAnalytics = adminLeads.addResource("analytics");
adminLeadAnalytics.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminLeadExport = adminLeads.addResource("export");
adminLeadExport.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminLeadById = adminLeads.addResource("{id}");
adminLeadById.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminLeadById.addMethod("PATCH", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminLeadNotes = adminLeadById.addResource("notes");
adminLeadNotes.addMethod("POST", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

// Admin user routes (for assignee picker)
const adminUsers = admin.addResource("users");
adminUsers.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
```

**IMPORTANT:** The `analytics` and `export` resources must be added **before** the `{id}` resource on `adminLeads`, otherwise API Gateway will match `/leads/analytics` as `/leads/{id}` with `id=analytics`.

**Proxy Lambda allow-list:** Add `cognito-idp:list_users_in_group` to the `ALLOWED_ACTIONS` env var on the `AwsApiProxyFunction` in the CDK stack.

---

## 6. Admin web — types and API layer

### 6.1 OpenAPI spec update

**File:** `docs/api/admin.yaml`

Add schemas:
- `LeadListResponse`, `LeadDetailResponse`, `LeadSummary`, `LeadDetail`
- `LeadContact`, `LeadEvent`, `LeadNote`
- `CreateLeadRequest`, `UpdateLeadRequest`, `CreateLeadNoteRequest`
- `LeadAnalyticsResponse`
- `AdminUserListResponse`, `AdminUser`
- Enums: `FunnelStage`, `LeadType`, `LeadEventType`, `ContactSource`

Add paths for all 8 endpoints defined in section 4.

### 6.2 Regenerate types

```bash
cd apps/admin_web
npm run generate:admin-api-types
npm run check:admin-api-types
```

This populates `apps/admin_web/src/types/generated/admin-api.generated.ts` with the new lead types.

### 6.3 API client functions

**File:** `apps/admin_web/src/lib/leads-api.ts` (new)

```typescript
// Functions using adminApiRequest from api-admin-client.ts:

export async function listLeads(params: LeadListParams): Promise<LeadListResponse>
export async function getLead(id: string): Promise<LeadDetailResponse>
export async function createLead(body: CreateLeadRequest): Promise<LeadDetailResponse>
export async function updateLead(id: string, body: UpdateLeadRequest): Promise<LeadDetailResponse>
export async function createLeadNote(leadId: string, body: CreateLeadNoteRequest): Promise<LeadNote>
export async function getLeadAnalytics(params: AnalyticsParams): Promise<LeadAnalyticsResponse>
export async function exportLeadsCsv(params: LeadListParams): Promise<Blob>
```

**File:** `apps/admin_web/src/lib/users-api.ts` (new)

```typescript
export async function listAdminUsers(): Promise<AdminUserListResponse>
```

Follow the same patterns as `apps/admin_web/src/lib/assets-api.ts`: use `adminApiRequest`, map generated types to app types, handle errors.

---

## 7. Admin web — hooks

All hooks follow the existing pattern in `apps/admin_web/src/hooks/` (local state, no Redux).

### 7.1 `useAdminUsers`

**File:** `apps/admin_web/src/hooks/use-admin-users.ts` (new)

- Fetches and caches admin user list on mount
- Returns `{ users, isLoading, error, refetch }`
- Used by the assignee picker and for resolving `sub` → email/name throughout the UI

### 7.2 `useLeadList`

**File:** `apps/admin_web/src/hooks/use-lead-list.ts` (new)

- Manages filter state: `stage`, `source`, `leadType`, `assignedTo`, `unassigned`, `dateFrom`, `dateTo`, `search`, `sort`, `sortDir`
- Cursor pagination: `loadMore()`, `hasMore`
- Returns `{ leads, filters, setFilter, clearFilters, isLoading, error, refetch, loadMore, hasMore, totalCount }`

### 7.3 `useLeadDetail`

**File:** `apps/admin_web/src/hooks/use-lead-detail.ts` (new)

- Fetches single lead detail when `leadId` changes
- Returns `{ lead, events, notes, isLoading, error, refetch }`

### 7.4 `useLeadMutations`

**File:** `apps/admin_web/src/hooks/use-lead-mutations.ts` (new)

- `createLead(body)` — calls POST, returns created lead
- `updateStage(id, stage, lostReason?)` — calls PATCH
- `assignLead(id, assignedTo)` — calls PATCH
- `addNote(leadId, content)` — calls POST notes
- Each mutation returns `{ mutate, isLoading, error }`
- On success, triggers refetch of the lead list and detail

### 7.5 `useLeadAnalytics`

**File:** `apps/admin_web/src/hooks/use-lead-analytics.ts` (new)

- Manages date range state
- Fetches analytics when date range changes
- Returns `{ analytics, dateRange, setDateRange, isLoading, error, refetch }`

### 7.6 `useSalesPage`

**File:** `apps/admin_web/src/hooks/use-sales-page.ts` (new)

- Orchestrator hook that composes the above hooks
- Manages active view (funnel overview vs. analytics)
- Manages selected lead ID for the detail panel
- Returns everything the `SalesPage` component needs

---

## 8. Admin web — UI components

### 8.1 Navigation integration

**File:** `apps/admin_web/src/app/page.tsx`

**Changes:**
- Add `'sales'` to `NAV_ITEMS`: `[{ key: 'sales', label: 'Sales' }, { key: 'assets', label: 'Client assets' }]`
- Import `SalesPage` component
- Render `SalesPage` when `activeSectionKey === 'sales'`
- Set default active section to `'sales'`

### 8.2 Component tree

```
sales-page.tsx                    # Top-level orchestrator
├── sales-header.tsx              # Title, date range picker, refresh button, new lead button
├── funnel-overview.tsx           # Funnel chart + KPI cards (default tab)
│   ├── funnel-chart.tsx          # Horizontal tapered funnel (Recharts)
│   ├── kpi-cards.tsx             # Summary metric cards row
│   └── source-breakdown.tsx      # Bar chart of leads by source
├── leads-table.tsx               # Main leads table
│   ├── leads-filter-bar.tsx      # Stage pills, source filter, assignee filter, search
│   ├── leads-table-row.tsx       # Single row with inline stage badge
│   └── leads-bulk-actions.tsx    # Bulk assign, bulk stage change
├── lead-detail-panel.tsx         # Slide-over panel (matches asset editor pattern)
│   ├── lead-info-section.tsx     # Contact info + lead info
│   ├── stage-control.tsx         # Stage transition dropdown with validation
│   ├── activity-timeline.tsx     # Chronological event list
│   ├── notes-section.tsx         # Notes list + add note form
│   └── lead-quick-actions.tsx    # Email, convert, lose, reassign buttons
├── create-lead-dialog.tsx        # Modal for manual lead creation
├── analytics-view.tsx            # Analytics tab
│   ├── conversion-funnel.tsx     # Stage-to-stage drop-off chart
│   ├── leads-over-time.tsx       # Line chart
│   ├── time-in-stage.tsx         # Bar chart
│   └── assignee-leaderboard.tsx  # Table with per-assignee stats
└── lead-export-button.tsx        # CSV export trigger
```

**All files under:** `apps/admin_web/src/components/admin/sales/`

### 8.3 Detailed component specifications

#### `sales-page.tsx`

- Two tabs: "Pipeline" (default) and "Analytics"
- Pipeline tab shows: `sales-header` → `funnel-overview` → `leads-table`
- Analytics tab shows: `sales-header` → `analytics-view`
- When a lead is selected from the table, `lead-detail-panel` slides in from the right
- Uses `useSalesPage` hook for all state

#### `sales-header.tsx`

- Title: "Sales Pipeline" or "Sales Analytics" depending on tab
- Date range picker: preset ranges (This week, This month, This quarter, This year, All time) + custom date inputs
- "Refresh" button (ghost variant)
- "New lead" button (primary variant) — opens `create-lead-dialog`
- "Export CSV" button (outline variant) — calls export with current filters

#### `funnel-chart.tsx`

- Horizontal tapered funnel showing: New → Contacted → Engaged → Qualified → Converted
- Each stage is a colored bar with count and percentage label
- `Lost` shown as a separate bar below in red
- Clickable — clicking a stage filters the leads table to that stage
- Use Recharts `BarChart` with custom bar shapes for the taper effect, or a custom SVG funnel
- Color scheme: blue gradient darkening through stages, emerald for converted, red for lost

#### `kpi-cards.tsx`

Four `Card` components in a row:

| Card | Value | Subtitle |
|------|-------|----------|
| Total leads | `142` | "in selected period" |
| Conversion rate | `8.5%` | "converted / total" |
| Avg. days to convert | `14.2` | "from new to converted" |
| New this week | `12` | "+3 vs last week" (if data available) |

#### `source-breakdown.tsx`

- Horizontal bar chart or pill-style counts
- Shows top sources sorted by count
- Color-coded by source category

#### `leads-table.tsx`

- Full-width table with columns: checkbox, Name, Email, Source, Stage, Assigned, Created, Days in stage, Actions
- Stage shown as a colored badge: blue (new), cyan (contacted), indigo (engaged), violet (qualified), emerald (converted), red (lost)
- "Days in stage" shows a warning icon (amber) if > 7 days
- Row click opens detail panel
- Checkbox column for bulk selection
- Sticky header
- Cursor pagination: "Load more" button at bottom

#### `leads-filter-bar.tsx`

- Stage filter: clickable pill buttons for each stage (multi-select), plus "All"
- Source dropdown: multi-select
- Assignee dropdown: from `useAdminUsers`
- Lead type dropdown: multi-select
- Search input: debounced, searches name/email
- "Clear all" link to reset filters

#### `lead-detail-panel.tsx`

- Slides in from the right over the table (similar pattern to asset editor)
- Close button (X) in top-right
- Sections stacked vertically with dividers

#### `stage-control.tsx`

- Current stage shown as a large colored badge
- "Change stage" dropdown showing all stages with directional arrows
- When selecting `lost`, a textarea for `lost_reason` appears (required)
- Confirmation step before committing the transition
- Shows the from → to transition clearly

#### `activity-timeline.tsx`

- Vertical timeline with dots and connecting lines
- Each event shows: icon (based on event_type), description, `created_by` (resolved to email via `useAdminUsers`), relative timestamp
- Event type icons: stage change (arrow), note (document), email sent (envelope), assigned (person), created (plus), guide downloaded (download)
- Most recent first

#### `notes-section.tsx`

- List of existing notes with author and timestamp
- "Add note" textarea at the top with a submit button
- Notes are not editable after creation (audit trail integrity)

#### `lead-quick-actions.tsx`

- "Send email" — `mailto:` link with contact email, only shown if email exists
- "Mark converted" — shortcut to change stage to converted (with confirmation)
- "Mark lost" — shortcut to change stage to lost (opens lost reason form)
- "Reassign" — opens assignee picker dropdown

#### `create-lead-dialog.tsx`

- Modal overlay (reuse `ConfirmDialog` pattern or similar)
- Form fields:
  - First name (required) — `Input`
  - Last name (optional) — `Input`
  - Email (optional) — `Input` type=email
  - Phone (optional) — `Input` type=tel
  - Instagram handle (optional) — `Input`
  - Source (required) — `Select` with all `ContactSource` values
  - Source detail (optional) — `Input` (e.g., "Summer camp inquiry via WhatsApp")
  - Lead type (required) — `Select` with all `LeadType` values
  - Contact type (optional, default: parent) — `Select`
  - Assign to (optional) — `Select` from admin users
  - Initial note (optional) — `Textarea`
- Submit button creates the lead and closes the dialog
- On success, refreshes the lead list and selects the new lead

#### `analytics-view.tsx`

- Grid layout with chart cards
- Four sections:
  1. **Conversion funnel** — stage-to-stage drop-off rates as a funnel/waterfall chart
  2. **Leads over time** — line/area chart (weekly or monthly based on date range)
  3. **Time in stage** — horizontal bar chart showing avg days per stage
  4. **Team performance** — table showing per-assignee: total leads, converted, conversion rate, avg days

### 8.4 Styling guidelines

- Use existing Tailwind v4 slate palette
- Stage badge colors:
  - `new` → `bg-blue-100 text-blue-800`
  - `contacted` → `bg-cyan-100 text-cyan-800`
  - `engaged` → `bg-indigo-100 text-indigo-800`
  - `qualified` → `bg-violet-100 text-violet-800`
  - `converted` → `bg-emerald-100 text-emerald-800`
  - `lost` → `bg-red-100 text-red-800`
- Cards: reuse existing `Card` component
- Buttons: reuse existing `Button` variants
- Tables: plain HTML `<table>` with Tailwind (match assets table pattern)
- Mobile-first responsive: stack on small screens, side-by-side on `lg:`
- No inline styles (per `.cursorrules`)
- No `CSSProperties` (per `.cursorrules`)

---

## 9. Documentation updates

| File | Changes |
|------|---------|
| `docs/api/admin.yaml` | Add all 8 new endpoint paths and schemas (see section 4) |
| `docs/architecture/lambdas.md` | Add lead management routes to `EvolvesproutsAdminFunction` description |
| `docs/architecture/database-schema.md` | Verify CRM tables are documented; add note about new `contact_source` enum values |
| `docs/architecture/aws-assets-map.md` | Add `cognito-idp:list_users_in_group` to proxy allow-list documentation |

---

## 10. Testing

### 10.1 Backend tests

**Directory:** `tests/`

| Test file | Covers |
|-----------|--------|
| `tests/unit/api/test_admin_leads.py` | All lead endpoint handlers: list, get, create, update, notes, export |
| `tests/unit/api/test_admin_users.py` | Admin users endpoint, proxy integration |
| `tests/unit/repositories/test_sales_lead_repository.py` | Extend existing: add tests for `list_leads`, `get_analytics` |
| `tests/unit/repositories/test_crm_note_repository.py` | CRUD operations |
| `tests/unit/db/test_0008_migration.py` | Migration applies cleanly, new enum values exist |

**Key test scenarios:**

- List leads with various filter combinations
- Stage transition validation (lost requires reason, converted sets timestamp)
- Stage transition bidirectional (forward and backward)
- Create lead with email dedup (existing contact)
- Create lead without email
- Analytics date range filtering
- CSV export content validation
- Authorization (admin group required)
- Pagination cursor stability

### 10.2 Admin web tests

**Directory:** `apps/admin_web/tests/components/admin/sales/`

| Test file | Covers |
|-----------|--------|
| `sales-page.test.tsx` | Tab switching, navigation integration |
| `leads-table.test.tsx` | Rendering, sorting, filtering, row selection |
| `lead-detail-panel.test.tsx` | Stage transitions, note creation |
| `stage-control.test.tsx` | Stage change flow, lost reason requirement |
| `create-lead-dialog.test.tsx` | Form validation, submission |
| `funnel-chart.test.tsx` | Rendering with data, click interactions |
| `analytics-view.test.tsx` | Date range changes, chart rendering |

**Mock responses:** Align with `docs/api/admin.yaml` schemas and the response shapes defined in section 4.

---

## 11. Implementation sequence

Execute in this order. Each phase should be a separate commit (or small group of commits).

### Phase 1: Database migration and enum expansion

1. Create `0008_expand_crm_enums` Alembic migration
2. Update `ContactSource` enum in `backend/src/app/db/models/enums.py`
3. Update `ContactRepository._SOURCE_PRIORITY` dict with new sources
4. Run `pre-commit run ruff-format --all-files`

### Phase 2: Backend repositories

1. Add `CrmNoteRepository` in `backend/src/app/db/repositories/crm_note.py`
2. Extend `SalesLeadRepository` with `list_leads(...)`, `get_lead_detail(...)`, `get_analytics(...)`, `update_stage(...)`, `update_assignee(...)`
3. Extend `ContactRepository` if needed for search capabilities
4. Run `pre-commit run ruff-format --all-files`

### Phase 3: Backend API handlers

1. Create `backend/src/app/api/admin_leads.py` — all lead handlers
2. Create `backend/src/app/api/admin_users.py` — admin user list handler
3. Register routes in `backend/src/app/api/admin.py` `_ROUTES` tuple
4. Run `pre-commit run ruff-format --all-files`

### Phase 4: CDK and infrastructure

1. Add API Gateway routes in `backend/infrastructure/lib/api-stack.ts`
2. Add `cognito-idp:list_users_in_group` to proxy Lambda allow-list
3. Ensure `USER_POOL_ID` env var is available on admin Lambda

### Phase 5: OpenAPI spec and type generation

1. Update `docs/api/admin.yaml` with all new endpoints and schemas
2. Run `npm run generate:admin-api-types` in `apps/admin_web`
3. Run `npm run check:admin-api-types` to verify

### Phase 6: Admin web API layer and hooks

1. Add `recharts` dependency: `cd apps/admin_web && npm install recharts`
2. Create `apps/admin_web/src/lib/leads-api.ts`
3. Create `apps/admin_web/src/lib/users-api.ts`
4. Create all hooks (section 7)

### Phase 7: Admin web UI components

1. Create all components under `apps/admin_web/src/components/admin/sales/`
2. Update `apps/admin_web/src/app/page.tsx` to add Sales nav item and render `SalesPage`
3. Implement in order: sales-page → funnel-overview → leads-table → lead-detail-panel → create-lead-dialog → analytics-view

### Phase 8: Documentation

1. Update `docs/architecture/lambdas.md`
2. Update `docs/architecture/database-schema.md`
3. Update `docs/architecture/aws-assets-map.md`

### Phase 9: Testing

1. Backend unit tests
2. Admin web component tests
3. Run `bash scripts/validate-cursorrules.sh`
4. Run `npm run lint` in `apps/admin_web`

---

## Appendices

### A. Enum reference (current + new)

**ContactSource (after migration):**
`free_guide`, `newsletter`, `contact_form`, `reservation`, `referral`, `instagram`, `manual`, `whatsapp` (new), `linkedin` (new), `event` (new), `phone_call` (new), `public_website` (new)

**LeadType (unchanged):**
`free_guide`, `event_inquiry`, `program_enrollment`, `consultation`, `partnership`, `other`

**FunnelStage (unchanged):**
`new`, `contacted`, `engaged`, `qualified`, `converted`, `lost`

**LeadEventType (unchanged):**
`created`, `stage_changed`, `note_added`, `email_sent`, `email_opened`, `guide_downloaded`, `assigned`, `converted`, `lost`

### B. Existing file reference

| File | Role | Modify? |
|------|------|---------|
| `backend/src/app/db/models/enums.py` | Python enums | Yes — add ContactSource values |
| `backend/src/app/db/models/sales_lead.py` | SalesLead, SalesLeadEvent models | No |
| `backend/src/app/db/models/contact.py` | Contact model | No |
| `backend/src/app/db/models/crm_note.py` | CrmNote model | No |
| `backend/src/app/db/repositories/sales_lead.py` | SalesLead repo | Yes — extend |
| `backend/src/app/db/repositories/contact.py` | Contact repo | Yes — add source priority, possibly search |
| `backend/src/app/db/repositories/base.py` | Base repo | No |
| `backend/src/app/api/admin.py` | Route dispatch | Yes — add lead and user routes |
| `backend/src/app/api/admin_locations.py` | Location handlers (reference pattern) | No |
| `backend/src/app/services/aws_proxy.py` | AWS proxy client | No (use existing `invoke()`) |
| `backend/infrastructure/lib/api-stack.ts` | CDK API routes | Yes — add lead and user routes |
| `apps/admin_web/src/app/page.tsx` | Admin app entry | Yes — add Sales nav |
| `apps/admin_web/src/components/app-shell.tsx` | Shell layout | No |
| `apps/admin_web/src/lib/api-admin-client.ts` | Base API client | No |
| `apps/admin_web/src/lib/assets-api.ts` | Assets API (reference pattern) | No |
| `docs/api/admin.yaml` | OpenAPI spec | Yes — add lead schemas/paths |
| `docs/architecture/lambdas.md` | Lambda catalog | Yes — update |
| `docs/architecture/database-schema.md` | Schema docs | Yes — update |

### C. New files to create

| File | Purpose |
|------|---------|
| `backend/db/alembic/versions/0008_expand_crm_enums.py` | Alembic migration |
| `backend/src/app/api/admin_leads.py` | Lead API handlers |
| `backend/src/app/api/admin_users.py` | Admin users API handler |
| `backend/src/app/db/repositories/crm_note.py` | CRM note repository |
| `apps/admin_web/src/lib/leads-api.ts` | Lead API client |
| `apps/admin_web/src/lib/users-api.ts` | Admin users API client |
| `apps/admin_web/src/hooks/use-admin-users.ts` | Admin users hook |
| `apps/admin_web/src/hooks/use-lead-list.ts` | Lead list hook |
| `apps/admin_web/src/hooks/use-lead-detail.ts` | Lead detail hook |
| `apps/admin_web/src/hooks/use-lead-mutations.ts` | Lead mutations hook |
| `apps/admin_web/src/hooks/use-lead-analytics.ts` | Lead analytics hook |
| `apps/admin_web/src/hooks/use-sales-page.ts` | Sales page orchestrator hook |
| `apps/admin_web/src/components/admin/sales/sales-page.tsx` | Sales page |
| `apps/admin_web/src/components/admin/sales/sales-header.tsx` | Header with date range and actions |
| `apps/admin_web/src/components/admin/sales/funnel-overview.tsx` | Funnel section |
| `apps/admin_web/src/components/admin/sales/funnel-chart.tsx` | Funnel visualization |
| `apps/admin_web/src/components/admin/sales/kpi-cards.tsx` | KPI metric cards |
| `apps/admin_web/src/components/admin/sales/source-breakdown.tsx` | Source distribution chart |
| `apps/admin_web/src/components/admin/sales/leads-table.tsx` | Leads table |
| `apps/admin_web/src/components/admin/sales/leads-filter-bar.tsx` | Filter controls |
| `apps/admin_web/src/components/admin/sales/leads-table-row.tsx` | Table row |
| `apps/admin_web/src/components/admin/sales/leads-bulk-actions.tsx` | Bulk action bar |
| `apps/admin_web/src/components/admin/sales/lead-detail-panel.tsx` | Detail slide-over |
| `apps/admin_web/src/components/admin/sales/lead-info-section.tsx` | Contact/lead info |
| `apps/admin_web/src/components/admin/sales/stage-control.tsx` | Stage transition UI |
| `apps/admin_web/src/components/admin/sales/activity-timeline.tsx` | Event timeline |
| `apps/admin_web/src/components/admin/sales/notes-section.tsx` | Notes CRUD |
| `apps/admin_web/src/components/admin/sales/lead-quick-actions.tsx` | Quick action buttons |
| `apps/admin_web/src/components/admin/sales/create-lead-dialog.tsx` | New lead form |
| `apps/admin_web/src/components/admin/sales/analytics-view.tsx` | Analytics tab |
| `apps/admin_web/src/components/admin/sales/conversion-funnel.tsx` | Conversion rates chart |
| `apps/admin_web/src/components/admin/sales/leads-over-time.tsx` | Trend line chart |
| `apps/admin_web/src/components/admin/sales/time-in-stage.tsx` | Time-in-stage chart |
| `apps/admin_web/src/components/admin/sales/assignee-leaderboard.tsx` | Team performance table |
| `apps/admin_web/src/components/admin/sales/lead-export-button.tsx` | CSV export button |
| `tests/unit/api/test_admin_leads.py` | Lead API tests |
| `tests/unit/api/test_admin_users.py` | Users API tests |
| `tests/unit/repositories/test_crm_note_repository.py` | CRM note repo tests |
| `apps/admin_web/tests/components/admin/sales/sales-page.test.tsx` | Sales page tests |
| `apps/admin_web/tests/components/admin/sales/leads-table.test.tsx` | Table tests |
| `apps/admin_web/tests/components/admin/sales/lead-detail-panel.test.tsx` | Detail panel tests |
| `apps/admin_web/tests/components/admin/sales/stage-control.test.tsx` | Stage control tests |
| `apps/admin_web/tests/components/admin/sales/create-lead-dialog.test.tsx` | Create dialog tests |
| `apps/admin_web/tests/components/admin/sales/funnel-chart.test.tsx` | Funnel chart tests |
| `apps/admin_web/tests/components/admin/sales/analytics-view.test.tsx` | Analytics tests |
