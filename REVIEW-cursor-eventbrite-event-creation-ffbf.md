# Code Review: `cursor/eventbrite-event-creation-ffbf` vs `main`

## Summary

Large PR (198 files, ~19,300 insertions / ~3,800 deletions) introducing:
- Eventbrite event sync pipeline (Lambda, SQS, client, sync logic)
- Public calendar events API and legacy proxy endpoints
- CRM contacts/families/organizations CRUD (admin backend + admin web UI)
- Venues panel, instructor listing, geocoding integration
- Stripe payment context (live vs staging key selection)
- Hero quick-fact chips refactor (public_www)
- Copy updates across all three locales
- New database migrations (location name, sovereign country, Eventbrite sync columns)

---

## Issues Found

### HIGH Severity

#### 1. Python file exceeds 500-line limit — `backend/src/app/api/admin_contacts.py`
- **Rule**: "Keep Python files under 500 lines" (General code style)
- **Current**: 675 lines
- **Recommendation**: Extract `_create_contact` / `_update_contact` (each 80+ lines of dense field parsing) into `admin_contacts_mutations.py`, or split the membership sync and referral logic into `admin_contacts_helpers.py`.

#### 2. Missing structured logging in 7 new API modules
- **Rule**: "Use robust error handling with contextual logging" (Python project guidance); "Use structured logging with `get_logger()`" (Security requirements)
- **Files with no `get_logger()` or `logger` usage**:
  - `backend/src/app/api/admin_contacts.py`
  - `backend/src/app/api/admin_families.py`
  - `backend/src/app/api/admin_organizations_crm.py`
  - `backend/src/app/api/admin_crm_helpers.py`
  - `backend/src/app/api/admin_crm_picker.py`
  - `backend/src/app/api/admin_crm_serializers.py`
  - `backend/src/app/api/public_events.py`
- All other existing API modules consistently use `logger = get_logger(__name__)`.
- **Recommendation**: Add `get_logger(__name__)` and at least INFO-level entry-point logging.

#### 3. Contacts panel main listing table missing Operations column
- **Rule**: "Listing blocks … table with a trailing Operations column (right-aligned header) for row actions" (Admin Web shell and layout standard, MANDATORY)
- **File**: `apps/admin_web/src/components/admin/contacts/contacts-panel.tsx`
- The contacts table has columns: Name, Email, Type, Status — but no Operations column. Families and organizations member sub-tables correctly include Operations columns, but the main contacts listing table omits it.
- **Recommendation**: Add a right-aligned "Operations" header column for row-scoped actions (archive, etc.).

### MEDIUM Severity

#### 4. `zh-HK` locale has untranslated English template string
- **Rule**: "Keep `zh-CN.json` and `zh-HK.json` aligned" / "All user-visible copy must live in locale JSON files" (Public WWW locale content contract, MANDATORY)
- **Key**: `bookingModal.paymentModal.selectedAgeGroupTitleTemplate`
- **`zh-HK` value**: `"{title} for age group {ageGroupLabel}"` (English)
- **`zh-CN` value**: `"{title}（适用于{ageGroupLabel}年龄组）"` (correctly translated)
- **`en` value**: `"{title} for age group {ageGroupLabel}"` (English, correct)
- The `zh-HK` entry was not translated and contains the English fallback.

#### 5. Migration filename does not match revision ID — `0018`
- **Convention**: Every other migration in the repo has filename == revision ID
- **File**: `backend/db/alembic/versions/0018_geo_area_sovereign_country.py`
- **Revision ID**: `0018_geo_area_sovereign` (23 chars)
- **Filename**: `0018_geo_area_sovereign_country.py` (has `_country` suffix)
- **Recommendation**: Rename file to `0018_geo_area_sovereign.py` or change revision ID to `0018_geo_area_sovereign_country` (31 chars, within 32-char limit) and update 0019's `down_revision`.

#### 6. Incomplete migration downgrade — `0018`
- **File**: `backend/db/alembic/versions/0018_geo_area_sovereign_country.py`
- The upgrade inserts China/Macau/Taiwan rows and sets sovereign links (lines 48-124). The downgrade only drops the `sovereign_country_id` column but does not delete the data rows.
- A downgrade-then-upgrade cycle leaves orphaned rows from the first run.
- **Recommendation**: Either add `DELETE FROM geographic_areas WHERE …` in downgrade, or document that rows are intentionally preserved.

#### 7. Hardcoded `'HKD'` currency in admin web — `instance-detail-panel.tsx`
- **Rule**: "Categorically ban hardcoded environment-specific values" (Constraints, MANDATORY)
- **File**: `apps/admin_web/src/components/admin/services/instance-detail-panel.tsx`
- Six occurrences of literal `'HKD'` when the codebase provides `getAdminDefaultCurrencyCode()` from `@/lib/config` (backed by `NEXT_PUBLIC_ADMIN_DEFAULT_CURRENCY`).
- This function is already used in `expenses-editor-panel.tsx`.
- **Recommendation**: Import and use `getAdminDefaultCurrencyCode()`.

#### 8. Function definitions placed between import blocks
- **Files**:
  - `apps/admin_web/src/components/admin/contacts/families-panel.tsx` (lines 4-14: `contactEligibleForFamilyMember` defined before remaining imports)
  - `apps/admin_web/src/components/admin/contacts/organizations-panel.tsx` (lines 4-14: `contactEligibleForOrgMember` defined before remaining imports)
- All imports should be grouped at the top of the file before any function definitions. This is a code style / linting issue.

#### 9. Boolean configuration values in locale JSON
- **Rule**: "All user-visible copy must live in locale JSON files" (Public WWW locale content contract)
- **Keys in `en.json` / `zh-CN.json` / `zh-HK.json`**:
  - `bookingModal.paymentModal.paymentOptionsFpsQrEnabled: true`
  - `bookingModal.paymentModal.paymentOptionsBankTransferEnabled: true`
  - `bookingModal.paymentModal.paymentOptionsStripeCardsEnabled: true`
- These are feature flags (booleans), not user-visible copy. Locale content files should contain translatable strings, not runtime configuration. These flags should live in an env variable or a separate config file.

### LOW Severity

#### 10. Hardcoded currency fallback `"HKD"` in backend — `eventbrite_sync.py:353`
- **Rule**: "Categorically ban hardcoded environment-specific values"
- **Code**: `return "HKD"` in `_resolve_currency()`
- While this is the business's only currency today, it should come from env or DB.

#### 11. Unused `_BASE_URL` constant — `eventbrite_client.py:14`
- **Code**: `_BASE_URL = "https://www.eventbriteapi.com/v3"` is defined but never referenced (actual base URL is passed via `base_url` parameter).
- Dead code — remove it.

#### 12. Duplicated `os.getenv("EVENTBRITE_API_BASE_URL", ...)` — `eventbrite_sync.py`
- **Rule**: "Avoid duplication; prefer reusable components/functions"
- The same `os.getenv("EVENTBRITE_API_BASE_URL", "https://www.eventbriteapi.com/v3")` appears in both `_eventbrite_call()` (line ~142) and `_event_url()` (line ~156).
- **Recommendation**: Extract to a single helper or class attribute.

#### 13. `_event_url()` returns API URL, not public URL
- **File**: `backend/src/app/services/eventbrite_sync.py`
- The `_event_url()` function constructs an API endpoint URL as a fallback (`https://www.eventbriteapi.com/v3/events/{id}/`), which is not a valid public Eventbrite event page URL if exposed to users.

#### 14. Marketing report docs committed to repository
- **Files**: `apps/public_www/marketing/reports/ads-performance-assessment-2026-03-*.md`
- Three ads-performance-assessment Markdown files are included. These appear to be operational analysis documents rather than source code. Consider whether they belong in the repo or should be tracked elsewhere.

---

## Passing Checks (Positive Observations)

| Area | Status |
|------|--------|
| **No `print()` in production code** | PASS — all new production modules avoid `print()` |
| **No `random` for security tokens** | PASS — `hashlib.sha256` used appropriately |
| **No direct boto3 `cognito-idp` calls** | PASS — `aws_proxy.invoke()` used correctly |
| **No unmasked PII logging** | PASS — logs contain only IDs and status codes |
| **`admin.py` dispatch-focused** | PASS — at 292 lines, strictly dispatch orchestration |
| **Input validation** | PASS — thorough (string lengths, UUIDs, enums, dates, email, ILIKE escaping) |
| **Secrets from Secrets Manager** | PASS — Eventbrite token from Secrets Manager |
| **Retry logic** | PASS — `run_with_retry()` with 429/5xx detection |
| **No inline `style=` in JSX** | PASS — no violations found in admin_web or public_www |
| **No `CSSProperties` usage** | PASS |
| **No inline SVG** | PASS — all icons via SVGR (admin) or `/images/*.svg` (public) |
| **No `dangerouslySetInnerHTML` / `eval()`** | PASS — no XSS pattern violations |
| **CRUD UX: inline editor, not modals** | PASS — all CRM panels use `AdminEditorCard` |
| **Top-level nav alphabetically ordered** | PASS — Assets, Contacts, Finance, Sales, Services |
| **View switchers use `AdminTabStrip`** | PASS |
| **CDK secrets use `noEcho: true`** | PASS — all 12+ secret parameters verified |
| **No `Cors.ALL_ORIGINS`** | PASS — explicitly avoided |
| **Event JSON keys use `snake_case`** | PASS — `events.json` and `my-best-auntie-training-courses.json` |
| **Locale content aligned (en/zh-CN/zh-HK)** | MOSTLY PASS — aligned except zh-HK issue #4 |
| **Alembic revision IDs ≤ 32 chars** | PASS — 22, 23, and 20 chars respectively |
| **Seed-data assessment in migration docstrings** | PASS — all 6-item checklists present and accurate |
| **Migration chain integrity** | PASS — `down_revision` chain unbroken |
| **NOT NULL columns have server defaults** | PASS — `server_default` on both NOT NULL cols in 0019 |
| **New Lambda in `lambdas.md`** | PASS — EventbriteSyncProcessor documented |
| **New DB columns in `database-schema.md`** | PASS — sovereign_country_id, location name, Eventbrite cols documented |
| **New API routes in `api-stack.ts`** | PASS — all routes registered |
| **OpenAPI updated** | PASS — `admin.yaml` and `public.yaml` updated |
| **Comprehensive test coverage** | PASS — 13+ new test files covering CRM, events, sync, proxy, payments |
| **Good module decomposition** | PASS — CRM split into helpers/serializers/picker/entity modules |
| **Hero chip refactor** | PASS — DRY extraction from landing-page-hero into `HeroQuickFactChips` shared component |
| **Type hints** | PASS — complete annotations including return types |
| **AWS proxy pattern** | PASS — all outbound HTTP goes through `http_invoke()` |

---

## Summary Table

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **HIGH** | `backend/src/app/api/admin_contacts.py` | Exceeds 500-line limit (675 lines) |
| 2 | **HIGH** | 7 new backend API modules | Missing `get_logger()` structured logging |
| 3 | **HIGH** | `contacts-panel.tsx` main listing table | Missing Operations column |
| 4 | **MEDIUM** | `zh-HK.json` `selectedAgeGroupTitleTemplate` | Untranslated English string |
| 5 | **MEDIUM** | `0018_geo_area_sovereign_country.py` | Filename ≠ revision ID |
| 6 | **MEDIUM** | `0018_geo_area_sovereign_country.py` | Incomplete downgrade (data rows not cleaned) |
| 7 | **MEDIUM** | `instance-detail-panel.tsx` | 6x hardcoded `'HKD'` instead of `getAdminDefaultCurrencyCode()` |
| 8 | **MEDIUM** | `families-panel.tsx`, `organizations-panel.tsx` | Function definitions between import blocks |
| 9 | **MEDIUM** | `en.json`, `zh-CN.json`, `zh-HK.json` | Boolean feature flags in locale JSON (not user copy) |
| 10 | LOW | `eventbrite_sync.py:353` | Hardcoded `"HKD"` currency fallback |
| 11 | LOW | `eventbrite_client.py:14` | Dead code (`_BASE_URL` unused) |
| 12 | LOW | `eventbrite_sync.py` | Duplicated `os.getenv()` call |
| 13 | LOW | `eventbrite_sync.py` | `_event_url()` returns API URL, not public URL |
| 14 | LOW | `apps/public_www/marketing/reports/` | Marketing analysis docs in codebase |

**Blocking**: Issues #1, #2, #3 should be resolved before merge.
**Recommended before merge**: Issues #4, #5, #6, #7, #8, #9.
**Nice to fix**: Issues #10–#14.
