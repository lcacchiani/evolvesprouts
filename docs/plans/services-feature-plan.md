# Services Feature — Implementation Plan

This document is a self-contained implementation plan for the Services feature.
An implementing agent should follow it step-by-step, respecting the mandatory
workflow in `.cursorrules` (read rules, plan, validate, commit).

---

## Table of Contents

1. [Feature overview](#1-feature-overview)
2. [Data model — enums](#2-data-model--enums)
3. [Data model — tables](#3-data-model--tables)
4. [Alembic migration](#4-alembic-migration)
5. [SQLAlchemy models](#5-sqlalchemy-models)
6. [Repositories](#6-repositories)
7. [Backend API handlers](#7-backend-api-handlers)
8. [API Gateway routes (CDK)](#8-api-gateway-routes-cdk)
9. [OpenAPI spec](#9-openapi-spec)
10. [Admin web — types](#10-admin-web--types)
11. [Admin web — API client](#11-admin-web--api-client)
12. [Admin web — hooks](#12-admin-web--hooks)
13. [Admin web — components](#13-admin-web--components)
14. [Admin web — navigation wiring](#14-admin-web--navigation-wiring)
15. [Admin web — tests](#15-admin-web--tests)
16. [Documentation updates](#16-documentation-updates)
17. [Seed data assessment](#17-seed-data-assessment)
18. [Validation checklist](#18-validation-checklist)
19. [Commit plan](#19-commit-plan)

---

## 1. Feature overview

The owner offers three types of services:

| Service type | Pricing | Format |
|---|---|---|
| **Training course** | Always paid | Group or private (per instance) |
| **Event** | Free or paid (ticket tiers) | Open attendance |
| **Consultation** | Free (discovery) or paid (hourly/package) | 1-on-1 or group (per template) |

### Core concepts

- **Service** = reusable template (title, description, cover image, delivery
  mode, type-specific details). Status lifecycle: `draft` → `published` →
  `archived`.
- **Service instance** = a dated offering of a service (e.g. "My Best Auntie —
  May 2026"). Instances inherit `title`, `description`, `cover_image_s3_key`,
  and `delivery_mode` from the service template; any of these can be overridden
  per instance (null = inherit).
- **Instance session slots** = individual date/time blocks within an instance.
  Each slot can have its own location.
- **Enrollments** = registration/booking linking a contact, family, or
  organization to a service instance.
- **Discount codes** = flexible promo system scoped globally, to a service, or
  to a specific instance. Percentage or absolute, with optional date range.

### Inheritance model

```
resolve(instance_value, service_value):
    return instance_value if instance_value is not None else service_value
```

The admin UI will show inherited values as read-only placeholders in the
instance edit form.

---

## 2. Data model — enums

Create **11 new PostgreSQL enums**. Add corresponding Python `str, enum.Enum`
classes to `backend/src/app/db/models/enums.py`.

| Enum name | Values |
|---|---|
| `service_type` | `training_course`, `event`, `consultation` |
| `service_status` | `draft`, `published`, `archived` |
| `service_delivery_mode` | `online`, `in_person`, `hybrid` |
| `training_format` | `group`, `private` |
| `training_pricing_unit` | `per_person`, `per_family` |
| `event_category` | `workshop`, `webinar`, `open_house`, `community_meetup`, `other` |
| `consultation_format` | `one_on_one`, `group` |
| `consultation_pricing_model` | `free`, `hourly`, `package` |
| `instance_status` | `scheduled`, `open`, `full`, `in_progress`, `completed`, `cancelled` |
| `discount_type` | `percentage`, `absolute` |
| `enrollment_status` | `registered`, `waitlisted`, `confirmed`, `cancelled`, `completed` |

### Python enum pattern

Follow the existing pattern in `backend/src/app/db/models/enums.py`:

```python
class ServiceType(str, enum.Enum):
    """Discriminator for service categories."""

    TRAINING_COURSE = "training_course"
    EVENT = "event"
    CONSULTATION = "consultation"
```

Repeat for all 11 enums. Then export them from
`backend/src/app/db/models/__init__.py`.

---

## 3. Data model — tables

### 3.1 `services` — unified template

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `service_type` | enum `service_type` | NOT NULL |
| `title` | `varchar(255)` | NOT NULL |
| `description` | `text` | nullable |
| `cover_image_s3_key` | `varchar` | nullable |
| `delivery_mode` | enum `service_delivery_mode` | NOT NULL |
| `status` | enum `service_status` | NOT NULL, default `'draft'` |
| `created_by` | `varchar(128)` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

Indexes:
- `services_type_idx` on `service_type`
- `services_status_idx` on `status`

Trigger: `services_set_updated_at` → `set_updated_at()`

### 3.2 `training_course_details` — 1:1 extension

| Column | Type | Constraints |
|---|---|---|
| `service_id` | `UUID` | PK, FK → `services.id` CASCADE |
| `pricing_unit` | enum `training_pricing_unit` | NOT NULL, default `'per_person'` |
| `default_price` | `numeric(10,2)` | nullable |
| `default_currency` | `varchar(3)` | NOT NULL, default `'HKD'` |

### 3.3 `event_details` — 1:1 extension

| Column | Type | Constraints |
|---|---|---|
| `service_id` | `UUID` | PK, FK → `services.id` CASCADE |
| `event_category` | enum `event_category` | NOT NULL |

### 3.4 `consultation_details` — 1:1 extension

| Column | Type | Constraints |
|---|---|---|
| `service_id` | `UUID` | PK, FK → `services.id` CASCADE |
| `consultation_format` | enum `consultation_format` | NOT NULL |
| `max_group_size` | `integer` | nullable |
| `duration_minutes` | `integer` | NOT NULL |
| `pricing_model` | enum `consultation_pricing_model` | NOT NULL |
| `default_hourly_rate` | `numeric(10,2)` | nullable |
| `default_package_price` | `numeric(10,2)` | nullable |
| `default_package_sessions` | `integer` | nullable |
| `default_currency` | `varchar(3)` | NOT NULL, default `'HKD'` |
| `calendly_url` | `varchar(500)` | nullable |

### 3.5 `service_instances` — dated offering

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `service_id` | `UUID` | FK → `services.id` CASCADE, NOT NULL |
| `title` | `varchar(255)` | nullable (null = inherit) |
| `description` | `text` | nullable (null = inherit) |
| `cover_image_s3_key` | `varchar` | nullable (null = inherit) |
| `status` | enum `instance_status` | NOT NULL, default `'scheduled'` |
| `delivery_mode` | enum `service_delivery_mode` | nullable (null = inherit) |
| `location_id` | `UUID` | FK → `locations.id` SET NULL, nullable |
| `max_capacity` | `integer` | nullable (null = unlimited) |
| `waitlist_enabled` | `boolean` | NOT NULL, default `false` |
| `instructor_id` | `varchar(128)` | nullable (Cognito sub) |
| `notes` | `text` | nullable |
| `created_by` | `varchar(128)` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

Indexes:
- `svc_instances_service_idx` on `service_id`
- `svc_instances_status_idx` on `status`
- `svc_instances_instructor_idx` on `instructor_id`

Trigger: `service_instances_set_updated_at` → `set_updated_at()`

### 3.6 `instance_session_slots`

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `instance_id` | `UUID` | FK → `service_instances.id` CASCADE, NOT NULL |
| `location_id` | `UUID` | FK → `locations.id` SET NULL, nullable |
| `starts_at` | `timestamptz` | NOT NULL |
| `ends_at` | `timestamptz` | NOT NULL |
| `sort_order` | `integer` | NOT NULL, default `0` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Indexes:
- `session_slots_instance_idx` on `instance_id`

### 3.7 `training_instance_details` — 1:1 extension

| Column | Type | Constraints |
|---|---|---|
| `instance_id` | `UUID` | PK, FK → `service_instances.id` CASCADE |
| `training_format` | enum `training_format` | NOT NULL |
| `price` | `numeric(10,2)` | NOT NULL |
| `currency` | `varchar(3)` | NOT NULL, default `'HKD'` |
| `pricing_unit` | enum `training_pricing_unit` | NOT NULL, default `'per_person'` |

### 3.8 `event_ticket_tiers`

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `instance_id` | `UUID` | FK → `service_instances.id` CASCADE, NOT NULL |
| `name` | `varchar(100)` | NOT NULL |
| `description` | `text` | nullable |
| `price` | `numeric(10,2)` | NOT NULL (0 for free) |
| `currency` | `varchar(3)` | NOT NULL, default `'HKD'` |
| `max_quantity` | `integer` | nullable |
| `sort_order` | `integer` | NOT NULL, default `0` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Indexes:
- `ticket_tiers_instance_idx` on `instance_id`

### 3.9 `consultation_instance_details` — 1:1 extension

| Column | Type | Constraints |
|---|---|---|
| `instance_id` | `UUID` | PK, FK → `service_instances.id` CASCADE |
| `pricing_model` | enum `consultation_pricing_model` | NOT NULL |
| `price` | `numeric(10,2)` | nullable |
| `currency` | `varchar(3)` | NOT NULL, default `'HKD'` |
| `package_sessions` | `integer` | nullable |
| `calendly_event_url` | `varchar(500)` | nullable |

### 3.10 `discount_codes`

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `code` | `varchar(50)` | NOT NULL |
| `description` | `text` | nullable |
| `discount_type` | enum `discount_type` | NOT NULL |
| `discount_value` | `numeric(10,2)` | NOT NULL |
| `currency` | `varchar(3)` | nullable (required for absolute) |
| `valid_from` | `timestamptz` | nullable |
| `valid_until` | `timestamptz` | nullable |
| `service_id` | `UUID` | FK → `services.id` CASCADE, nullable |
| `instance_id` | `UUID` | FK → `service_instances.id` CASCADE, nullable |
| `max_uses` | `integer` | nullable |
| `current_uses` | `integer` | NOT NULL, default `0` |
| `active` | `boolean` | NOT NULL, default `true` |
| `created_by` | `varchar(128)` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

Indexes:
- `discount_codes_code_unique_idx` unique on `lower(code)`
- `discount_codes_service_idx` on `service_id`
- `discount_codes_instance_idx` on `instance_id`

Scope logic:
- `service_id IS NULL AND instance_id IS NULL` → global
- `service_id IS NOT NULL AND instance_id IS NULL` → service-scoped
- `instance_id IS NOT NULL` → instance-scoped

Trigger: `discount_codes_set_updated_at` → `set_updated_at()`

### 3.11 `enrollments`

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `instance_id` | `UUID` | FK → `service_instances.id` CASCADE, NOT NULL |
| `contact_id` | `UUID` | FK → `contacts.id` SET NULL, nullable |
| `family_id` | `UUID` | FK → `families.id` SET NULL, nullable |
| `organization_id` | `UUID` | FK → `organizations.id` SET NULL, nullable |
| `ticket_tier_id` | `UUID` | FK → `event_ticket_tiers.id` SET NULL, nullable |
| `discount_code_id` | `UUID` | FK → `discount_codes.id` SET NULL, nullable |
| `status` | enum `enrollment_status` | NOT NULL, default `'registered'` |
| `amount_paid` | `numeric(10,2)` | nullable |
| `currency` | `varchar(3)` | nullable |
| `enrolled_at` | `timestamptz` | NOT NULL, default `now()` |
| `cancelled_at` | `timestamptz` | nullable |
| `notes` | `text` | nullable |
| `created_by` | `varchar(128)` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

Check constraint: `enrollments_has_parent` — at least one of `contact_id`,
`family_id`, `organization_id` must be non-null.

Indexes:
- `enrollments_instance_idx` on `instance_id`
- `enrollments_contact_idx` on `contact_id`
- `enrollments_family_idx` on `family_id`
- `enrollments_org_idx` on `organization_id`
- `enrollments_status_idx` on `status`

Trigger: `enrollments_set_updated_at` → `set_updated_at()`

### 3.12 `service_tags` — junction

| Column | Type | Constraints |
|---|---|---|
| `service_id` | `UUID` | FK → `services.id` CASCADE, PK (composite) |
| `tag_id` | `UUID` | FK → `tags.id` CASCADE, PK (composite) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

### 3.13 `service_assets` — junction

| Column | Type | Constraints |
|---|---|---|
| `service_id` | `UUID` | FK → `services.id` CASCADE, PK (composite) |
| `asset_id` | `UUID` | FK → `assets.id` CASCADE, PK (composite) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

---

## 4. Alembic migration

**File:** `backend/db/alembic/versions/0010_add_services.py`

**Revision ID:** `0010_add_services` (19 chars — within 32-char limit)

**`down_revision`:** `"0009_expand_crm_enums"`

### Migration structure

Follow the exact pattern of `0007_add_crm_tables.py`:

1. Module docstring with seed-data assessment (see §17).
2. Imports: `from alembic import op`, `import sqlalchemy as sa`,
   `from sqlalchemy.dialects import postgresql`.
3. Declare all 11 enum objects with `create_type=False`.
4. `upgrade()`:
   - `bind = op.get_bind()`
   - Create all 11 enums with `.create(bind, checkfirst=True)`.
   - Create tables in dependency order:
     1. `services`
     2. `training_course_details`
     3. `event_details`
     4. `consultation_details`
     5. `service_instances`
     6. `instance_session_slots`
     7. `training_instance_details`
     8. `event_ticket_tiers`
     9. `consultation_instance_details`
     10. `discount_codes`
     11. `enrollments`
     12. `service_tags`
     13. `service_assets`
   - Create all indexes.
   - Create triggers for `services`, `service_instances`, `discount_codes`,
     `enrollments`.
5. `downgrade()`:
   - Drop triggers.
   - Drop indexes and tables in reverse dependency order.
   - Drop all 11 enums.

### Important notes

- The `set_updated_at()` function already exists (created in migration 0007).
  Do NOT recreate it. Just reference it in new triggers.
- Use `sa.Column(...)` with `postgresql.UUID(as_uuid=True)`,
  `sa.ForeignKey(...)`, `sa.TIMESTAMP(timezone=True)`, etc. — match the
  patterns in `0007_add_crm_tables.py` exactly.
- Use `sa.Numeric(10, 2)` for monetary columns.

---

## 5. SQLAlchemy models

### New files to create

All models use the same patterns as `backend/src/app/db/models/sales_lead.py`:
`Mapped[...]`, `mapped_column(...)`, `Enum(..., create_type=False)`,
`relationship()`, `__table_args__` for constraints and indexes.

#### 5.1 `backend/src/app/db/models/service.py`

Classes:
- `Service` — maps to `services`
- `TrainingCourseDetails` — maps to `training_course_details`
- `EventDetails` — maps to `event_details`
- `ConsultationDetails` — maps to `consultation_details`
- `ServiceTag` — maps to `service_tags`
- `ServiceAsset` — maps to `service_assets`

Relationships on `Service`:
- `training_course_details` → `TrainingCourseDetails` (uselist=False, cascade
  all/delete-orphan)
- `event_details` → `EventDetails` (uselist=False, cascade all/delete-orphan)
- `consultation_details` → `ConsultationDetails` (uselist=False, cascade
  all/delete-orphan)
- `instances` → `ServiceInstance` (list, cascade all/delete-orphan)
- `tags` → `Tag` via `ServiceTag` (secondary)
- `assets` → `Asset` via `ServiceAsset` (secondary)
- `discount_codes` → `DiscountCode` (list)

#### 5.2 `backend/src/app/db/models/service_instance.py`

Classes:
- `ServiceInstance` — maps to `service_instances`
- `InstanceSessionSlot` — maps to `instance_session_slots`
- `TrainingInstanceDetails` — maps to `training_instance_details`
- `EventTicketTier` — maps to `event_ticket_tiers`
- `ConsultationInstanceDetails` — maps to `consultation_instance_details`

Relationships on `ServiceInstance`:
- `service` → `Service`
- `location` → `Location`
- `session_slots` → `InstanceSessionSlot` (list, cascade all/delete-orphan)
- `training_details` → `TrainingInstanceDetails` (uselist=False, cascade
  all/delete-orphan)
- `ticket_tiers` → `EventTicketTier` (list, cascade all/delete-orphan)
- `consultation_details` → `ConsultationInstanceDetails` (uselist=False,
  cascade all/delete-orphan)
- `enrollments` → `Enrollment` (list)

#### 5.3 `backend/src/app/db/models/discount_code.py`

Class: `DiscountCode` — maps to `discount_codes`

Relationships:
- `service` → `Service` (nullable)
- `instance` → `ServiceInstance` (nullable)

#### 5.4 `backend/src/app/db/models/enrollment.py`

Class: `Enrollment` — maps to `enrollments`

Relationships:
- `instance` → `ServiceInstance`
- `contact` → `Contact` (nullable)
- `family` → `Family` (nullable)
- `organization` → `Organization` (nullable)
- `ticket_tier` → `EventTicketTier` (nullable)
- `discount_code` → `DiscountCode` (nullable)

### Update barrel file

Add all new classes and enums to `backend/src/app/db/models/__init__.py`
following the existing alphabetical pattern.

---

## 6. Repositories

### New files to create

#### 6.1 `backend/src/app/db/repositories/service.py`

Class: `ServiceRepository(BaseRepository[Service])`

Methods:
- `__init__(self, session)` — calls `super().__init__(session, Service)`
- `list_services(*, limit, service_type, status, search, cursor_created_at,
  cursor_id)` → list of `Service` with eager-loaded type details and tags
- `count_services(*, service_type, status, search)` → int
- `get_by_id_with_details(service_id)` → `Service | None` with all
  relationships loaded
- `create_service(service, type_details)` → `Service`
- `update_service(service)` → `Service`

#### 6.2 `backend/src/app/db/repositories/service_instance.py`

Class: `ServiceInstanceRepository(BaseRepository[ServiceInstance])`

Methods:
- `list_instances(*, service_id, limit, status, cursor_created_at, cursor_id)`
- `get_by_id_with_details(instance_id)` → with session_slots, type details,
  enrollments
- `create_instance(instance, type_details, session_slots)` → `ServiceInstance`
- `update_instance(instance)` → `ServiceInstance`
- `get_enrollment_count(instance_id)` → int
- `get_waitlist_count(instance_id)` → int

#### 6.3 `backend/src/app/db/repositories/discount_code.py`

Class: `DiscountCodeRepository(BaseRepository[DiscountCode])`

Methods:
- `list_codes(*, limit, active, service_id, instance_id, search,
  cursor_created_at, cursor_id)`
- `get_by_code(code)` → `DiscountCode | None` (case-insensitive)
- `validate_and_increment(code_id)` → validates active, date range, max_uses;
  increments `current_uses` atomically using `UPDATE ... SET current_uses =
  current_uses + 1 WHERE current_uses < max_uses` pattern

#### 6.4 `backend/src/app/db/repositories/enrollment.py`

Class: `EnrollmentRepository(BaseRepository[Enrollment])`

Methods:
- `list_enrollments(*, instance_id, limit, status, cursor_created_at,
  cursor_id)`
- `count_enrollments(*, instance_id, status)`
- `create_enrollment(enrollment)` — checks capacity before insert
- `update_status(enrollment_id, status)`

### Update barrel file

Add new repositories to `backend/src/app/db/repositories/__init__.py`.

---

## 7. Backend API handlers

### Route structure

All admin service routes live under `/v1/admin/services`.

| Method | Path | Handler |
|---|---|---|
| `GET` | `/v1/admin/services` | List services (paginated, filterable) |
| `POST` | `/v1/admin/services` | Create service |
| `GET` | `/v1/admin/services/{id}` | Get service with details |
| `PUT` | `/v1/admin/services/{id}` | Full update service |
| `PATCH` | `/v1/admin/services/{id}` | Partial update service |
| `DELETE` | `/v1/admin/services/{id}` | Delete service |
| `GET` | `/v1/admin/services/{id}/instances` | List instances for service |
| `POST` | `/v1/admin/services/{id}/instances` | Create instance |
| `GET` | `/v1/admin/services/{id}/instances/{instanceId}` | Get instance |
| `PUT` | `/v1/admin/services/{id}/instances/{instanceId}` | Update instance |
| `DELETE` | `/v1/admin/services/{id}/instances/{instanceId}` | Delete instance |
| `GET` | `/v1/admin/services/{id}/instances/{instanceId}/enrollments` | List enrollments |
| `POST` | `/v1/admin/services/{id}/instances/{instanceId}/enrollments` | Create enrollment |
| `PATCH` | `/v1/admin/services/{id}/instances/{instanceId}/enrollments/{enrollmentId}` | Update enrollment |
| `DELETE` | `/v1/admin/services/{id}/instances/{instanceId}/enrollments/{enrollmentId}` | Delete enrollment |
| `GET` | `/v1/admin/discount-codes` | List discount codes |
| `POST` | `/v1/admin/discount-codes` | Create discount code |
| `PUT` | `/v1/admin/discount-codes/{id}` | Update discount code |
| `DELETE` | `/v1/admin/discount-codes/{id}` | Delete discount code |

### Files to create

#### 7.1 `backend/src/app/api/admin_services.py`

Main handler: `handle_admin_services_request(event, method, path)`

Follow the pattern of `backend/src/app/api/admin_leads.py`:
- Use `split_route_parts(path)` and length-based routing.
- Use `extract_identity(event)` for auth.
- Use `Session(get_engine())` context manager.
- Use `set_audit_context(session, ...)` before writes.
- Use `json_response(status, body, event=event)` for all responses.

Implement private functions:
- `_list_services(event)` — query params: `service_type`, `status`, `search`,
  `cursor`, `limit`
- `_create_service(event, actor_sub)` — body varies by `service_type`
- `_get_service(event, service_id)`
- `_update_service(event, service_id, actor_sub)` — full or partial
- `_delete_service(event, service_id, actor_sub)`

#### 7.2 `backend/src/app/api/admin_services_common.py`

Shared helpers:
- `parse_service_filters(event)` → filter dict
- `parse_create_service_payload(body)` → validated payload
- `parse_update_service_payload(body)` → validated payload
- `serialize_service_summary(service)` → dict
- `serialize_service_detail(service)` → dict with type details and tags
- `encode_service_cursor(service)` → cursor string

#### 7.3 `backend/src/app/api/admin_service_instances.py`

Handler: `handle_admin_service_instances_request(event, method, path,
service_id)`

Called from `admin_services.py` when path depth reaches the instances segment.

Private functions:
- `_list_instances(event, service_id)`
- `_create_instance(event, service_id, actor_sub)`
- `_get_instance(event, service_id, instance_id)`
- `_update_instance(event, service_id, instance_id, actor_sub)`
- `_delete_instance(event, service_id, instance_id, actor_sub)`

#### 7.4 `backend/src/app/api/admin_enrollments.py`

Handler: `handle_admin_enrollments_request(event, method, path, instance_id)`

Private functions:
- `_list_enrollments(event, instance_id)`
- `_create_enrollment(event, instance_id, actor_sub)` — checks capacity, handles
  waitlist
- `_update_enrollment(event, instance_id, enrollment_id, actor_sub)`
- `_delete_enrollment(event, instance_id, enrollment_id, actor_sub)`

#### 7.5 `backend/src/app/api/admin_discount_codes.py`

Handler: `handle_admin_discount_codes_request(event, method, path)`

Private functions:
- `_list_discount_codes(event)`
- `_create_discount_code(event, actor_sub)`
- `_update_discount_code(event, code_id, actor_sub)`
- `_delete_discount_code(event, code_id, actor_sub)`

### Register routes

In `backend/src/app/api/admin.py`:

1. Add imports:
   ```python
   from app.api.admin_services import handle_admin_services_request
   from app.api.admin_discount_codes import handle_admin_discount_codes_request
   ```

2. Add to `_ROUTES` tuple:
   ```python
   ("/v1/admin/services", False, handle_admin_services_request),
   ("/v1/admin/discount-codes", False, handle_admin_discount_codes_request),
   ```

---

## 8. API Gateway routes (CDK)

**File:** `backend/infrastructure/lib/api-stack.ts`

Add after the admin users section (around line 2119), using the same pattern
as the existing lead/asset routes:

```typescript
// Admin service routes
const adminServices = admin.addResource("services");
adminServices.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminServices.addMethod("POST", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminServiceById = adminServices.addResource("{id}");
adminServiceById.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminServiceById.addMethod("PUT", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminServiceById.addMethod("PATCH", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminServiceById.addMethod("DELETE", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminServiceInstances = adminServiceById.addResource("instances");
adminServiceInstances.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminServiceInstances.addMethod("POST", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminServiceInstanceById = adminServiceInstances.addResource("{instanceId}");
adminServiceInstanceById.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminServiceInstanceById.addMethod("PUT", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminServiceInstanceById.addMethod("DELETE", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminInstanceEnrollments = adminServiceInstanceById.addResource("enrollments");
adminInstanceEnrollments.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminInstanceEnrollments.addMethod("POST", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminEnrollmentById = adminInstanceEnrollments.addResource("{enrollmentId}");
adminEnrollmentById.addMethod("PATCH", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminEnrollmentById.addMethod("DELETE", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

// Admin discount code routes
const adminDiscountCodes = admin.addResource("discount-codes");
adminDiscountCodes.addMethod("GET", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminDiscountCodes.addMethod("POST", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});

const adminDiscountCodeById = adminDiscountCodes.addResource("{id}");
adminDiscountCodeById.addMethod("PUT", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
adminDiscountCodeById.addMethod("DELETE", adminIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: adminAuthorizer,
});
```

---

## 9. OpenAPI spec

**File:** `docs/api/admin.yaml`

### Paths to add

Add all paths from the table in §7 with request/response schemas. Follow the
existing patterns:
- `security: [AdminBearerAuth: []]` on all routes.
- Standard error refs: `$ref: "#/components/responses/BadRequest"`, etc.
- Request bodies reference schemas defined in `components/schemas`.

### Schemas to add

Update the info description to include the new route list.

Add these schemas to `components/schemas`:

**Enums:**
- `ServiceType` — `enum: [training_course, event, consultation]`
- `ServiceStatus` — `enum: [draft, published, archived]`
- `ServiceDeliveryMode` — `enum: [online, in_person, hybrid]`
- `TrainingFormat` — `enum: [group, private]`
- `TrainingPricingUnit` — `enum: [per_person, per_family]`
- `EventCategory` — `enum: [workshop, webinar, open_house, community_meetup, other]`
- `ConsultationFormat` — `enum: [one_on_one, group]`
- `ConsultationPricingModel` — `enum: [free, hourly, package]`
- `InstanceStatus` — `enum: [scheduled, open, full, in_progress, completed, cancelled]`
- `DiscountType` — `enum: [percentage, absolute]`
- `EnrollmentStatus` — `enum: [registered, waitlisted, confirmed, cancelled, completed]`

**Service schemas:**
- `Service` — full service object with type details inlined
- `ServiceSummary` — list view (without full details)
- `ServiceListResponse` — `{items, next_cursor, total_count}`
- `ServiceResponse` — `{service}`
- `CreateServiceRequest` — `service_type` + common fields + type-specific
  details as a polymorphic union
- `UpdateServiceRequest`
- `PartialUpdateServiceRequest`

**Instance schemas:**
- `ServiceInstance` — full instance with session slots, type details
- `ServiceInstanceSummary` — list view
- `InstanceListResponse` — `{items, next_cursor, total_count}`
- `InstanceResponse` — `{instance}`
- `CreateInstanceRequest`
- `UpdateInstanceRequest`
- `SessionSlot` — `{starts_at, ends_at, location_id}`

**Enrollment schemas:**
- `Enrollment` — full enrollment
- `EnrollmentListResponse` — `{items, next_cursor, total_count}`
- `EnrollmentResponse` — `{enrollment}`
- `CreateEnrollmentRequest`
- `UpdateEnrollmentRequest`

**Discount code schemas:**
- `DiscountCode`
- `DiscountCodeListResponse` — `{items, next_cursor, total_count}`
- `DiscountCodeResponse` — `{discount_code}`
- `CreateDiscountCodeRequest`
- `UpdateDiscountCodeRequest`

---

## 10. Admin web — types

### 10.1 Regenerate types

After updating `docs/api/admin.yaml`, run:

```bash
cd apps/admin_web
npm run generate:admin-api-types
npm run check:admin-api-types
```

### 10.2 Create `apps/admin_web/src/types/services.ts`

Follow the pattern of `types/leads.ts` and `types/assets.ts`:

```typescript
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

function defineEnumValues<T extends string>() {
  return <U extends readonly T[]>(
    values: U & ([T] extends [U[number]] ? unknown : never)
  ) => values;
}

// Enum types + value arrays
export type ServiceType = ApiSchemas['ServiceType'];
export const SERVICE_TYPES = defineEnumValues<ServiceType>()(
  ['training_course', 'event', 'consultation'] as const
);

export type ServiceStatus = ApiSchemas['ServiceStatus'];
export const SERVICE_STATUSES = defineEnumValues<ServiceStatus>()(
  ['draft', 'published', 'archived'] as const
);

// ... repeat for all 11 enums

// Domain interfaces (camelCase mapped from API snake_case)
export interface ServiceSummary { ... }
export interface ServiceDetail extends ServiceSummary { ... }
export interface ServiceInstance { ... }
export interface Enrollment { ... }
export interface DiscountCode { ... }
export interface SessionSlot { ... }
export interface EventTicketTier { ... }

// Filter interfaces
export interface ServiceListFilters {
  serviceType: ServiceType | '';
  status: ServiceStatus | '';
  search: string;
}

export const DEFAULT_SERVICE_LIST_FILTERS: ServiceListFilters = {
  serviceType: '',
  status: '',
  search: '',
};

// ... similar for instances, enrollments, discount codes
```

---

## 11. Admin web — API client

### 11.1 Create `apps/admin_web/src/lib/services-api.ts`

Follow the pattern of `lib/leads-api.ts`:

```typescript
import { adminApiRequest } from './api-admin-client';
import { unwrapPayload } from './api-payload';
import { getAdminApiBaseUrl } from './config';
import type { components } from '@/types/generated/admin-api.generated';
// ... type imports

// --- Services ---
export async function listServices(filters, signal?) { ... }
export async function getService(id, signal?) { ... }
export async function createService(payload) { ... }
export async function updateService(id, payload) { ... }
export async function deleteService(id) { ... }

// --- Instances ---
export async function listInstances(serviceId, filters, signal?) { ... }
export async function getInstance(serviceId, instanceId, signal?) { ... }
export async function createInstance(serviceId, payload) { ... }
export async function updateInstance(serviceId, instanceId, payload) { ... }
export async function deleteInstance(serviceId, instanceId) { ... }

// --- Enrollments ---
export async function listEnrollments(serviceId, instanceId, filters, signal?) { ... }
export async function createEnrollment(serviceId, instanceId, payload) { ... }
export async function updateEnrollment(serviceId, instanceId, enrollmentId, payload) { ... }
export async function deleteEnrollment(serviceId, instanceId, enrollmentId) { ... }

// --- Discount Codes ---
export async function listDiscountCodes(filters, signal?) { ... }
export async function createDiscountCode(payload) { ... }
export async function updateDiscountCode(id, payload) { ... }
export async function deleteDiscountCode(id) { ... }
```

Each function uses `adminApiRequest()` with the appropriate endpoint path,
method, and body. Response parsing maps snake_case → camelCase.

---

## 12. Admin web — hooks

Create these hooks in `apps/admin_web/src/hooks/`:

### 12.1 `use-service-list.ts`

State: `services[]`, `filters`, `nextCursor`, `totalCount`, `isLoading`,
`isLoadingMore`, `error`.

Methods: `refetch()`, `loadMore()`, `setFilter()`, `clearFilters()`.

Pattern: follow `use-lead-list.ts` — `useRef` for latest filters, request ID
for race condition handling, debounced search.

### 12.2 `use-service-detail.ts`

State: `service`, `isLoading`, `error`.

Takes `serviceId` param. Fetches on mount and on ID change.

### 12.3 `use-service-mutations.ts`

Methods: `createService()`, `updateService()`, `deleteService()`.

State: `isLoading`, `error`.

Takes `onSuccess` callback for refetching.

### 12.4 `use-instance-list.ts`

Similar to `use-service-list` but scoped to a `serviceId`.

### 12.5 `use-instance-mutations.ts`

Methods: `createInstance()`, `updateInstance()`, `deleteInstance()`.

### 12.6 `use-enrollment-list.ts`

Scoped to an `instanceId`.

### 12.7 `use-enrollment-mutations.ts`

Methods: `createEnrollment()`, `updateEnrollment()`, `deleteEnrollment()`.

### 12.8 `use-discount-codes.ts`

Combined list + mutations for discount codes.

### 12.9 `use-services-page.ts`

Page composition hook (follows `use-sales-page.ts` pattern):

```typescript
export type ServicesView = 'catalog' | 'discount-codes';

export function useServicesPage() {
  const [activeView, setActiveView] = useState<ServicesView>('catalog');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  // ... compose all domain hooks
  return { ... };
}
```

---

## 13. Admin web — components

### Component tree

```
apps/admin_web/src/components/admin/services/
├── services-page.tsx              # Top-level page component
├── services-header.tsx            # Header with view toggle + new service btn
├── service-list-panel.tsx         # Service catalog table with filters
├── create-service-dialog.tsx      # Create service modal (type-aware form)
├── service-detail-panel.tsx       # Service detail slide-over/panel
├── service-form-fields.tsx        # Shared service form fields
├── training-form-fields.tsx       # Training-specific fields
├── event-form-fields.tsx          # Event-specific fields
├── consultation-form-fields.tsx   # Consultation-specific fields
├── instance-list-panel.tsx        # Instances table within service detail
├── create-instance-dialog.tsx     # Create instance modal
├── instance-detail-panel.tsx      # Instance detail with session slots
├── instance-form-fields.tsx       # Instance form fields
├── session-slot-editor.tsx        # Add/edit session slots (date/time/location)
├── enrollment-list-panel.tsx      # Enrollments table within instance
├── create-enrollment-dialog.tsx   # Create enrollment modal
├── discount-codes-panel.tsx       # Discount codes list + CRUD
└── create-discount-code-dialog.tsx # Create discount code modal
```

### 13.1 `services-page.tsx`

The entry point component:

```typescript
export function ServicesPage() {
  const state = useServicesPage();

  return (
    <div className='space-y-4'>
      <ServicesHeader ... />

      {state.activeView === 'catalog' ? (
        <>
          <ServiceListPanel ... />
          <ServiceDetailPanel ... />
          {/* Instance management is nested within service detail */}
        </>
      ) : (
        <DiscountCodesPanel ... />
      )}

      <CreateServiceDialog ... />
    </div>
  );
}
```

### 13.2 `service-list-panel.tsx`

Follow `asset-list-panel.tsx` pattern:
- `Card` wrapper with title "Services (N)"
- Filter bar: service type select, status select, search input
- Table with columns: Title, Type, Status, Delivery, Created
- Click row to select → opens detail panel
- "Load more" pagination

### 13.3 `create-service-dialog.tsx`

Follow `create-lead-dialog.tsx` pattern:
- Modal overlay with click-outside-to-close
- First step: select `service_type` (changes available fields)
- Common fields: title, description, delivery_mode
- Conditional type-specific fields:
  - Training: pricing_unit, default_price, default_currency
  - Event: event_category
  - Consultation: consultation_format, max_group_size, duration_minutes,
    pricing_model, hourly/package defaults, calendly_url

### 13.4 `service-detail-panel.tsx`

Slide-over or full panel showing:
- Service info (editable)
- Cover image upload (S3 presigned URL flow)
- Tags management
- Linked assets
- Status change actions (publish, archive)
- Instance list (nested `instance-list-panel.tsx`)

### 13.5 `instance-list-panel.tsx`

Table showing instances for the selected service:
- Columns: Title (or inherited), Status, Capacity (filled/max), Dates, Instructor
- Click to expand instance detail

### 13.6 `create-instance-dialog.tsx`

Instance form with:
- Title (optional — placeholder from service)
- Description (optional — placeholder from service)
- Status
- Delivery mode (optional — placeholder from service)
- Location picker
- Capacity settings
- Instructor assignment (from Cognito user group)
- Session slots editor
- Type-specific fields:
  - Training: format (group/private), price, currency, pricing_unit
  - Event: ticket tiers (dynamic list)
  - Consultation: pricing_model, price, package_sessions, calendly_event_url

### 13.7 `session-slot-editor.tsx`

Dynamic list of date/time/location rows:
- Each row: date picker, start time, end time, location select
- Add/remove buttons
- Sorted by `sort_order`

### 13.8 `enrollment-list-panel.tsx`

Table within instance detail:
- Columns: Contact/Family/Org name, Status, Amount, Enrolled At, Ticket Tier
- Create enrollment button
- Status change (dropdown or quick actions)
- Delete with confirm

### 13.9 `discount-codes-panel.tsx`

Full CRUD panel:
- List table: Code, Type, Value, Scope, Valid Range, Uses, Active
- Create button → dialog
- Edit inline or via dialog
- Delete with confirm

### UI patterns to follow

- Use existing `Card`, `Button`, `Input`, `Select`, `Textarea`, `Label`
  from `components/ui/`.
- Use `StatusBanner` for errors.
- Use `ConfirmDialog` + `useConfirmDialog` for destructive actions.
- Use `clsx` for conditional classes.
- No inline styles (mandatory).
- All components are `'use client'`.
- Named exports.

---

## 14. Admin web — navigation wiring

### 14.1 Update `apps/admin_web/src/app/page.tsx`

Add "Services" to `NAV_ITEMS`:

```typescript
const NAV_ITEMS = [
  { key: 'sales', label: 'Sales' },
  { key: 'services', label: 'Services' },
  { key: 'assets', label: 'Client assets' },
] as const;
```

Add conditional rendering in `LoginGate`:

```typescript
{activeSectionKey === 'sales' ? (
  <SalesPage />
) : activeSectionKey === 'services' ? (
  <ServicesPage />
) : (
  <AssetsPage />
)}
```

Add import:
```typescript
import { ServicesPage } from '../components/admin/services/services-page';
```

---

## 15. Admin web — tests

Tests go in `apps/admin_web/` under the vitest framework. Create focused tests
for:

- Type definitions and enum value arrays
- API client functions (mock `adminApiRequest`)
- Key hooks (service list, mutations)
- Create dialog form validation

Follow existing test patterns in the project.

---

## 16. Documentation updates

### 16.1 `docs/architecture/database-schema.md`

Add sections for all 13 new tables following the existing format. Add all 11
new enums to the enums section.

### 16.2 `docs/architecture/lambdas.md`

Update the Admin API section to include:
```
  `/v1/admin/services/*`, `/v1/admin/discount-codes/*`
```

### 16.3 `docs/api/admin.yaml`

Update the `info.description` to list all new routes. Add all path and schema
definitions (see §9).

---

## 17. Seed data assessment

Required for every DB change per `.cursorrules`.

1. **Compatibility with existing seed SQL:**
   `backend/db/seed/seed_data.sql` currently contains only a placeholder
   comment and no inserts. No existing statements will conflict.

2. **New NOT NULL/CHECK-constrained columns handled in seed data:**
   All constrained columns are in new tables only and do not affect existing
   seed statements.

3. **Renamed/dropped columns reflected in seed data:**
   No existing columns are renamed or dropped.

4. **New tables evaluated for seed rows:**
   New tables (`services`, `service_instances`, `enrollments`, etc.) do not
   require bootstrap seed data. They are user-populated via the admin UI.

5. **Enum/allowed-value changes validated in seed rows:**
   Only new enums are introduced; no existing enums are modified.

6. **FK/cascade changes validated for insert order and references:**
   New FKs reference existing tables (`locations`, `contacts`, `families`,
   `organizations`, `assets`, `tags`) and new tables created in dependency
   order within the migration.

**Result:** No seed data updates required.

---

## 18. Validation checklist

Before each commit:

- [ ] `pre-commit run ruff-format --all-files` (Python formatting)
- [ ] `bash scripts/validate-cursorrules.sh` (rule contract)
- [ ] `cd apps/admin_web && npm run generate:admin-api-types` (type gen)
- [ ] `cd apps/admin_web && npm run check:admin-api-types` (type drift)
- [ ] `cd apps/admin_web && npm run lint` (ESLint + drift)
- [ ] `cd apps/admin_web && npm run test` (vitest)
- [ ] Verify migration revision ID is ≤ 32 chars:
      `echo -n "0010_add_services" | wc -c` → 17

---

## 19. Commit plan

Split into logical commits:

### Commit 1: Database migration + models
- `backend/db/alembic/versions/0010_add_services.py`
- `backend/src/app/db/models/enums.py` (add 11 enum classes)
- `backend/src/app/db/models/service.py` (new)
- `backend/src/app/db/models/service_instance.py` (new)
- `backend/src/app/db/models/discount_code.py` (new)
- `backend/src/app/db/models/enrollment.py` (new)
- `backend/src/app/db/models/__init__.py` (update exports)

### Commit 2: Repositories
- `backend/src/app/db/repositories/service.py` (new)
- `backend/src/app/db/repositories/service_instance.py` (new)
- `backend/src/app/db/repositories/discount_code.py` (new)
- `backend/src/app/db/repositories/enrollment.py` (new)
- `backend/src/app/db/repositories/__init__.py` (update exports)

### Commit 3: Backend API handlers + route registration
- `backend/src/app/api/admin_services.py` (new)
- `backend/src/app/api/admin_services_common.py` (new)
- `backend/src/app/api/admin_service_instances.py` (new)
- `backend/src/app/api/admin_enrollments.py` (new)
- `backend/src/app/api/admin_discount_codes.py` (new)
- `backend/src/app/api/admin.py` (add routes)

### Commit 4: CDK + OpenAPI
- `backend/infrastructure/lib/api-stack.ts` (add API Gateway routes)
- `docs/api/admin.yaml` (add paths + schemas)

### Commit 5: Admin web — types + API client + hooks
- `apps/admin_web/src/types/services.ts` (new)
- `apps/admin_web/src/types/generated/admin-api.generated.ts` (regenerated)
- `apps/admin_web/src/lib/services-api.ts` (new)
- All new hooks in `apps/admin_web/src/hooks/`

### Commit 6: Admin web — components + navigation
- All new components in
  `apps/admin_web/src/components/admin/services/`
- `apps/admin_web/src/app/page.tsx` (add Services tab)

### Commit 7: Documentation + tests
- `docs/architecture/database-schema.md`
- `docs/architecture/lambdas.md`
- Admin web tests

---

## Appendix A: Edge cases and risks

1. **Discount code race conditions** — `current_uses` increment must be atomic.
   Use `UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = :id
   AND (max_uses IS NULL OR current_uses < max_uses) RETURNING id`. If no row
   returned, the code is exhausted.

2. **Capacity enforcement** — Enrollment creation must check capacity
   atomically. Use a subquery count within the INSERT or a
   `SELECT FOR UPDATE` on the instance row.

3. **Cascade deletion awareness** — Deleting a service cascades to all
   instances, session slots, enrollments, type-specific details, tags, and
   linked assets. The admin UI must use `ConfirmDialog` with a clear warning.

4. **Cover image upload** — Requires a presigned S3 URL endpoint. This can
   reuse the existing asset upload presigned URL pattern but store the S3 key
   directly on the service (not in the `assets` table). If the existing
   presigned URL flow is tightly coupled to the assets table, create a minimal
   `/v1/admin/services/{id}/cover-image` endpoint that returns a presigned
   upload URL and updates `cover_image_s3_key`.

5. **Instructor from Cognito group** — The instructor picker should call
   `/v1/admin/users` filtered by the instructor user group. If this filtering
   is not yet supported, extend the users endpoint or add a group filter
   parameter.

6. **Enum evolution** — Adding new values to PostgreSQL enums later requires
   `ALTER TYPE ... ADD VALUE`. The initial enum sets should be comprehensive.
   Review all values with the owner before migration.
