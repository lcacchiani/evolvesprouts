# Review: PR #1023 — cursor/public-endpoints-list-766e

Assessment of branch `cursor/public-endpoints-list-766e` (PR #1023).

## Issues

### 1. CRITICAL — Scope creep: PR bundles unrelated feature work with renames

PR title says "Rename public client-resources endpoints" but the branch also
ships a new `POST /v1/discounts/validate` endpoint, discount validity window
enforcement, shared currency config, admin UI datetime pickers, language-label
format changes, and a reusable `LoadingGearIcon`. These should be separate PRs.

### 2. HIGH — `_path_matches` hardcoded special-case is fragile

`backend/src/app/api/admin.py` line ~310 hardcodes a guard for
`/v1/assets/public/free/` inside the generic path matcher. Only covers
`/v1/assets/public`, not hypothetical `/www/v1/assets/public`. A
precedence-based or explicit-route-priority approach would be more robust.

### 3. HIGH — `public_discount_validate.py` has zero structured logging

Every other public handler uses `get_logger(__name__)` and logs at minimum the
incoming request. The new discount-validate handler has no logger import and no
log statements, violating the `.cursorrules` security/observability mandate.

### 4. MEDIUM — `_is_usable_now` boundary semantics vs OpenAPI docs

OpenAPI says "on or before `valid_until`" (inclusive) but `datetime.now(UTC)` has
microsecond precision, creating edge-case failures when `valid_until` is stored
at second/minute resolution. Boundary contract should be documented or code
should truncate to match.

### 5. MEDIUM — `_resolve_config_path` traverses `here.parent` twice

`(here.parent, *here.parents)` visits the same directory twice (harmless but
sloppy).

### 6. MEDIUM — `lru_cache` on `_load_currency_config` has no invalidation path

Tests that need to swap the config JSON have no clean way to clear the cache.

### 7. MEDIUM — `www/v1/reservations` possibly missing from CloudFront POST allowlist

The router defines `POST /www/v1/reservations` but the CloudFront allowlist only
lists `/www/v1/legacy/reservations` and `/www/v1/reservations/payment-intent`.

### 8. LOW — Admin web hardcodes discount validity error string in English

`discount-codes-panel.tsx` uses a literal
`'Valid until must be on or after valid from.'` instead of a localizable
constant.

### 9. LOW — Unsafe `as` type assertion for `contentLanguage`

`asset-editor-panel.tsx` casts `contentLanguageTrimmed as AdminAssetWriteContentLanguage`
without runtime validation.

### 10. LOW — OpenAPI `DiscountValidationResponse` uses `additionalProperties: true`

For a new native endpoint, the response schema should be strict.

### 11. INFO — Smoke test now targets native discount endpoint

Deployment ordering dependency: backend stack must be deployed before public-www
smoke passes.

### 12. INFO — PR body references `test_public_assets_routes.py` not in the diff

Should confirm this test file was actually executed.
