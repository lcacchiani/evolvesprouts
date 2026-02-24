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

## Table: assets

Purpose: Stores asset metadata for files in S3.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `title` (varchar(255), required)
- `description` (text, optional)
- `asset_type` (enum `asset_type`, required) — categorization
- `s3_key` (varchar, unique, required) — object key in S3
- `file_name` (varchar(255), required) — original filename
- `file_size_bytes` (bigint, optional) — for display purposes
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

## Access control logic

**Public assets** (`visibility = 'public'`):
- Any request (even unauthenticated) gets a presigned download URL.
- Servable via the public website or mobile app without login.

**Restricted assets** (`visibility = 'restricted'`):
- User authenticates via Cognito.
- Lambda checks `asset_access_grants` for a matching row:
  - `grant_type = 'all_authenticated'` — any logged-in user
  - `grant_type = 'organization'` + `grantee_id = user's org` — org members
  - `grant_type = 'user'` + `grantee_id = user's sub` — specific user
- If authorized, returns a short-lived presigned GET URL (15-minute expiry).
- If denied, returns 403.
- Admin/Manager always have full access.
