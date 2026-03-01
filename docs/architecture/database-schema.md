# Database Schema

This document describes the PostgreSQL schema for the Evolve Sprouts
backend. It is based on the Alembic migrations.

Alembic migrations live in `backend/db/alembic/versions/`.
Seed data lives in `backend/db/seed/seed_data.sql`.

## Extensions and enums

- Extension: `pgcrypto` (used by `gen_random_uuid()` defaults).
- Enum `asset_type`: `guide`, `video`, `pdf`, `document`.
- Enum `asset_visibility`: `public`, `restricted`.
- Enum `access_grant_type`: `all_authenticated`, `organization`, `user`.
- Enum `contact_type`: `parent`, `child`, `helper`, `professional`, `other`.
- Enum `contact_source`: `free_guide`, `newsletter`, `contact_form`,
  `reservation`, `referral`, `instagram`, `manual`.
- Enum `relationship_type`: `prospect`, `client`, `past_client`, `partner`,
  `vendor`, `other`.
- Enum `mailchimp_sync_status`: `pending`, `synced`, `failed`, `unsubscribed`.
- Enum `family_role`: `parent`, `child`, `helper`, `guardian`, `other`.
- Enum `organization_type`: `school`, `company`, `community_group`, `ngo`, `other`.
- Enum `organization_role`: `admin`, `staff`, `teacher`, `member`, `client`,
  `partner`, `other`.
- Enum `lead_type`: `free_guide`, `event_inquiry`, `program_enrollment`,
  `consultation`, `partnership`, `other`.
- Enum `funnel_stage`: `new`, `contacted`, `engaged`, `qualified`, `converted`,
  `lost`.
- Enum `lead_event_type`: `created`, `stage_changed`, `note_added`, `email_sent`,
  `email_opened`, `guide_downloaded`, `assigned`, `converted`, `lost`.

## Table: assets

Purpose: Stores asset metadata for files in S3.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `title` (varchar(255), required)
- `description` (text, optional)
- `asset_type` (enum `asset_type`, required) — categorization
- `s3_key` (varchar, unique, required) — object key in S3
- `file_name` (varchar(255), required) — original filename
- `content_type` (varchar(127), optional) — MIME type
- `visibility` (enum `asset_visibility`, required) — access level
- `created_by` (varchar(128), required) — Cognito sub of uploader
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()`)

Object key pattern: `assets/{asset_id}/{uuid}-{sanitized_filename}`

Indexes:
- `assets_visibility_idx` on `visibility`
- `assets_asset_type_idx` on `asset_type`
- `assets_created_by_idx` on `created_by`
- Unique constraint on `s3_key`

## Table: asset_access_grants

Purpose: Controls who can access restricted assets.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `asset_id` (UUID, FK → assets.id, cascade delete)
- `grant_type` (enum `access_grant_type`, required) — scope of grant
- `grantee_id` (varchar(128), nullable) — org ID or user sub
  (null for `all_authenticated`)
- `granted_by` (varchar(128), required) — admin who granted
- `created_at` (timestamptz, default `now()`)

Constraints:
- Unique on (`asset_id`, `grant_type`, `COALESCE(grantee_id, '')`)

Indexes:
- `access_grants_asset_idx` on `asset_id`
- `access_grants_grantee_idx` on `grantee_id`
- `access_grants_unique` unique index on
  (`asset_id`, `grant_type`, `COALESCE(grantee_id, '')`)

## Table: asset_share_links

Purpose: Stores stable bearer links for assets that can be shared externally.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `asset_id` (UUID, FK → `assets.id`, cascade delete, unique)
- `share_token` (varchar(128), unique, required)
- `allowed_domains` (varchar(255)[], required) — source domains allowed to
  resolve the share link (no server default; runtime configuration provides
  values)
- `created_by` (varchar(128), required) — admin user sub that created the link
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()`)

Indexes:
- `asset_share_links_asset_idx` unique index on `asset_id`
- `asset_share_links_token_idx` unique index on `share_token`

## Access control logic

**Public assets** (`visibility = 'public'`):
- Any request (even unauthenticated) gets a CloudFront-signed download URL.
- Servable via the public website or mobile app without login.

**Restricted assets** (`visibility = 'restricted'`):
- User authenticates via Cognito.
- Lambda checks `asset_access_grants` for a matching row:
  - `grant_type = 'all_authenticated'` — any logged-in user
  - `grant_type = 'organization'` + `grantee_id = user's org` — org members
  - `grant_type = 'user'` + `grantee_id = user's sub` — specific user
- If authorized, returns a CloudFront-signed GET URL
  (`ASSET_DOWNLOAD_LINK_EXPIRY_DAYS`, default `9999`).
- If denied, returns 403.
- Admin/Manager always have full access.

**Stable share links** (`/v1/assets/share/{token}`):
- A token in `asset_share_links.share_token` acts as a bearer capability.
- Requests with a valid token resolve the asset and redirect to a fresh
  CloudFront-signed GET URL.
- Requests are accepted only when Referer/Origin matches
  `asset_share_links.allowed_domains`.
- If the resolved asset has `visibility='restricted'`, the request must also
  include a valid Cognito bearer token.
- Admin APIs can create/reuse, rotate, revoke, and update source-domain
  allowlist policy per asset.

## CRM tables (media lead capture)

### `contacts`

- Purpose: canonical contact profile for CRM and campaign sync.
- Key fields: `email`, `first_name`, `contact_type`, `source`,
  `mailchimp_status`.
- Key indexes: case-insensitive unique email/instagram indexes and source/type
  indexes.

### `families` and `family_members`

- `families` stores household-level entities.
- `family_members` links contacts to families with role metadata.
- `family_members` rows are deleted automatically when either parent record is
  deleted (`ON DELETE CASCADE`).

### `organizations` and `organization_members`

- `organizations` stores external organization entities.
- `organization_members` links contacts to organizations with role/title.
- Membership rows use `ON DELETE CASCADE`.

### `tags`, `contact_tags`, `family_tags`, `organization_tags`

- `tags` stores reusable labels.
- Junction tables model many-to-many tagging across contacts/families/orgs.
- Junction rows use composite primary keys and cascade deletion.

### `sales_leads`

- Purpose: lead lifecycle tracking for contacts/families/organizations.
- Includes `lead_type`, `funnel_stage`, optional `asset_id`.
- `sales_leads_guide_dedup_idx` enforces idempotency for media processing
  by unique (`contact_id`, `lead_type`, `asset_id`) when `asset_id` is present.

### `sales_lead_events`

- Immutable event log for lead lifecycle transitions and actions.
- Rows cascade delete with parent lead (`lead_id` FK with `ON DELETE CASCADE`).

### `crm_notes`

- Free-form notes linked to contacts/families/organizations/leads.
- Uses `ON DELETE SET NULL` for parent references so note history can be kept.
- Constraint `crm_notes_has_parent` enforces that at least one parent reference
  is present.

## Shared update trigger

- Function: `set_updated_at()`.
- Applied to: `contacts`, `families`, `organizations`, `sales_leads`,
  `crm_notes`.
- Behavior: updates `updated_at` to `now()` before each UPDATE.
