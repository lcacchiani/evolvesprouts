# Backend Improvement Opportunities

> **Generated:** 2026-02-28
> **Scope:** `backend/**` (shared source, Lambda handlers, database, infrastructure)
> **Status:** Assessment complete — items ready for implementation

---

## How to use this document

Each finding has a **unique ID**, **severity**, **category**, **affected files**, and
a concrete **recommended fix**. An implementing agent should:

1. Pick items by priority (HIGH → MEDIUM → LOW).
2. Follow the file and function references exactly.
3. After each fix, run `pre-commit run ruff-format --all-files` and
   `bash scripts/validate-cursorrules.sh`.
4. Commit each logical fix separately with a message referencing the finding ID
   (e.g. `fix(backend): resolve B-SEC-01 — remove error detail leak`).

---

## Table of Contents

- [Category 1 — Security](#category-1--security)
- [Category 2 — Code Duplication](#category-2--code-duplication)
- [Category 3 — Architecture & Design](#category-3--architecture--design)
- [Category 4 — Test Coverage](#category-4--test-coverage)
- [Category 5 — Code Quality & Best Practices](#category-5--code-quality--best-practices)
- [Category 6 — Operational & Reliability](#category-6--operational--reliability)
- [Priority Summary](#priority-summary)
- [Recommended Implementation Order](#recommended-implementation-order)

---

## Category 1 — Security

### B-SEC-01 · HIGH — Internal error details leaked to API clients

**File:** `backend/src/app/api/admin.py` line 70

**Problem:**
The `_safe_handler` catch-all for unhandled exceptions returns `str(exc)` in the
HTTP response body:

```python
return json_response(
    500, {"error": "Internal server error", "detail": str(exc)}, event=event
)
```

This can expose stack traces, database error messages, file paths, or other
internal details to API callers. The error is already captured by
`logger.exception` on the line above.

**Fix:**
Remove `"detail": str(exc)` from the response dict. The response should only
contain a generic error message:

```python
return json_response(
    500, {"error": "Internal server error"}, event=event
)
```

**Files to modify:**
- `backend/src/app/api/admin.py` — `_safe_handler()`, line 70

---

### B-SEC-02 · MEDIUM — Bearer token extraction duplicated with subtle inconsistencies

**Files:**
- `backend/lambda/authorizers/cognito_group/handler.py` — `_extract_token()` (lines 56-66)
- `backend/lambda/authorizers/cognito_user/handler.py` — `_extract_token()` (lines 54-64)
- `backend/src/app/api/assets/share_assets.py` — `_extract_bearer_token()` (lines 86-102)

**Problem:**
Three independent implementations of bearer-token extraction exist. The
authorizer versions return the raw header value when it does not start with
`"bearer "`. The `share_assets.py` version follows a slightly different code
path with different variable handling. Behavioral drift across these
implementations can lead to security inconsistencies (e.g., one accepting a
malformed token that another rejects).

**Fix:**
Create a single `extract_bearer_token(headers)` function in
`backend/src/app/auth/authorizer_utils.py` (see B-DUP-01) and import it in all
three locations.

**Files to modify:**
- `backend/src/app/auth/authorizer_utils.py` (new file)
- `backend/lambda/authorizers/cognito_group/handler.py`
- `backend/lambda/authorizers/cognito_user/handler.py`
- `backend/src/app/api/assets/share_assets.py`

---

### B-SEC-03 · LOW — `collect_query_params` may double-count parameter values

**File:** `backend/src/app/utils/parsers.py` — `collect_query_params()` (lines 123-151)

**Problem:**
API Gateway populates both `queryStringParameters` (last value per key) and
`multiValueQueryStringParameters` (all values per key). The function iterates
over both and appends to the same dict, so a key present in both fields will
have its last single-value entry *plus* all multi-value entries. This can
double-count values.

**Fix:**
Prefer `multiValueQueryStringParameters` when present. Fall back to
`queryStringParameters` only when multi-value is absent:

```python
def collect_query_params(event: Mapping[str, Any]) -> dict[str, list[str]]:
    params: dict[str, list[str]] = {}
    multi = event.get("multiValueQueryStringParameters") or {}
    if multi:
        for key, values in multi.items():
            if values:
                params[key] = [v for v in values if v is not None]
        return params

    single = event.get("queryStringParameters") or {}
    for key, value in single.items():
        if value is not None:
            params[key] = [value]
    return params
```

**Files to modify:**
- `backend/src/app/utils/parsers.py` — `collect_query_params()`

---

## Category 2 — Code Duplication

### B-DUP-01 · HIGH — Authorizer helpers duplicated across 3 Lambda handlers (~120 lines)

**Files:**
- `backend/lambda/authorizers/cognito_group/handler.py`
- `backend/lambda/authorizers/cognito_user/handler.py`
- `backend/lambda/authorizers/device_attestation/handler.py`

**Problem:**
The following functions are copy-pasted identically between `cognito_group` and
`cognito_user`:

| Function                       | Lines each | Copies |
|--------------------------------|------------|--------|
| `_extract_organization_ids()`  | 14         | 2      |
| `_get_header()`                | 6          | 3*     |
| `_extract_token()`             | 11         | 2      |
| `_policy()`                    | 27         | 3*     |

*`device_attestation` has its own `_get_header()` (identical) and `_policy()`
(slightly different — lacks the ARN-broadening logic for API Gateway caching).

**Fix:**
1. Create `backend/src/app/auth/authorizer_utils.py` with:
   - `get_header_case_insensitive(headers, name) -> str`
   - `extract_bearer_token(headers) -> str | None`
   - `extract_organization_ids(raw_claims) -> set[str]`
   - `build_iam_policy(effect, method_arn, principal_id, context, broaden_resource=True) -> dict`
2. Update `backend/src/app/auth/__init__.py` to export these.
3. Refactor all three authorizer handlers to import from the shared module.
4. For `device_attestation`, call `build_iam_policy(..., broaden_resource=False)`
   to preserve its current behavior.

**Files to modify:**
- `backend/src/app/auth/authorizer_utils.py` (new)
- `backend/src/app/auth/__init__.py`
- `backend/lambda/authorizers/cognito_group/handler.py`
- `backend/lambda/authorizers/cognito_user/handler.py`
- `backend/lambda/authorizers/device_attestation/handler.py`

---

### B-DUP-02 · MEDIUM — `_use_iam_auth()` duplicated in two DB modules

**Files:**
- `backend/src/app/db/connection.py` — `_use_iam_auth()` (lines 61-64)
- `backend/src/app/db/engine.py` — `_use_iam_auth()` (lines 75-77)

**Problem:**
Identical 3-line function defined in both files:

```python
def _use_iam_auth() -> bool:
    return str(os.getenv("DATABASE_IAM_AUTH", "")).lower() in {"1", "true", "yes"}
```

**Fix:**
Keep `_use_iam_auth()` only in `connection.py` (or promote to a public function
`use_iam_auth()` in `connection.py`). Import it in `engine.py`.

**Files to modify:**
- `backend/src/app/db/connection.py` — rename to `use_iam_auth()` (remove underscore)
- `backend/src/app/db/engine.py` — remove local copy, import from `connection`

---

### B-DUP-03 · MEDIUM — `_required_env` / `_require_env` helper duplicated

**Files:**
- `backend/src/app/services/cloudfront_signing.py` — `_required_env()` (line 116)
- `backend/src/app/api/admin_request.py` — `_require_env()` (line 114)
- `backend/src/app/api/assets/assets_common.py` — inline env checks (line 343)

**Problem:**
Three independent implementations of "read env var or raise RuntimeError". The
project already defines `ConfigurationError` in `exceptions.py` (line 93) but
none of these use it.

**Fix:**
1. Add a `require_env(name: str) -> str` function to `backend/src/app/utils/__init__.py`
   (or a new `backend/src/app/utils/config.py`).
2. Have it raise `ConfigurationError(name)` instead of bare `RuntimeError`.
3. Replace all three callsites (and the inline check in `assets_common.py`).

**Files to modify:**
- `backend/src/app/utils/__init__.py` (or new `config.py`)
- `backend/src/app/services/cloudfront_signing.py`
- `backend/src/app/api/admin_request.py`
- `backend/src/app/api/assets/assets_common.py`

---

### B-DUP-04 · LOW — Pagination boilerplate repeated across listing endpoints

**Files:**
- `backend/src/app/api/assets/admin_assets.py` — `_list_assets()` (lines 102-129)
- `backend/src/app/api/assets/user_assets.py` — `_list_accessible_assets()` (lines 51-82)
- `backend/src/app/api/assets/public_assets.py` — `_list_public_assets()` (lines 46-66)

**Problem:**
The `limit + 1` fetch / `page_items[:limit]` / `_encode_cursor` pattern is
repeated verbatim in every listing handler (~15 lines each).

**Fix:**
Add a pagination helper to `assets_common.py`:

```python
def paginate_response(
    items: Sequence[T],
    limit: int,
    event: Mapping[str, Any],
    serializer: Callable[[T], dict[str, Any]],
) -> dict[str, Any]:
    page_items = list(items[:limit])
    next_cursor = (
        _encode_cursor(page_items[-1].id)
        if len(items) > limit and page_items
        else None
    )
    return json_response(
        200,
        {"items": [serializer(item) for item in page_items], "next_cursor": next_cursor},
        event=event,
    )
```

Then each handler calls: `return paginate_response(assets, limit, event, serialize_asset)`

**Files to modify:**
- `backend/src/app/api/assets/assets_common.py`
- `backend/src/app/api/assets/admin_assets.py`
- `backend/src/app/api/assets/user_assets.py`
- `backend/src/app/api/assets/public_assets.py`

---

## Category 3 — Architecture & Design

### B-ARCH-01 · MEDIUM — No `pyproject.toml` or packaging metadata

**File:** `backend/` (directory level)

**Problem:**
The backend has only `requirements.txt` with 8 pinned runtime dependencies.
There is no `pyproject.toml`, `setup.py`, or `setup.cfg`. Consequences:

- No editable install (`pip install -e .`) for local development
- No way to distinguish direct vs. transitive dependencies
- No dependency groups (dev, test, lint)
- No package metadata or entry points
- `requirements.txt` alone cannot express optional/extra dependencies

**Fix:**
Add `backend/pyproject.toml` with:
- `[project]` section with name, version, Python requirement
- `[project.dependencies]` mirroring current `requirements.txt`
- `[project.optional-dependencies]` with `dev` and `test` groups
- `[tool.ruff]` configuration (if not already in a shared config)
- Keep `requirements.txt` as a deployment lockfile for Lambda builds

**Files to create:**
- `backend/pyproject.toml`

**Files to modify:**
- `backend/requirements.txt` (keep as-is for Lambda builds)

---

### B-ARCH-02 · MEDIUM — Route matching uses fragile string-prefix functions

**File:** `backend/src/app/api/admin.py` — `_match_handler()` (lines 74-91)

**Problem:**
Each route requires a dedicated `_is_*_path()` boolean function and a
corresponding `if` branch in `_match_handler()`. Adding a new route requires
modifying two places. The approach does not support path parameters natively
(they are extracted later inside each handler). As the API grows, this becomes
hard to maintain and easy to get wrong (ordering matters for prefix overlap).

**Fix:**
Replace with a declarative route table or a lightweight registry pattern:

```python
_ROUTES: list[tuple[str, Callable]] = [
    ("/v1/reservations", _handle_public_reservation),
    ("/v1/admin/assets", handle_admin_assets_request),
    ("/v1/user/assets", handle_user_assets_request),
    ("/v1/assets/share", handle_share_assets_request),
    ("/v1/assets/public", handle_public_assets_request),
]

def _match_handler(*, event, method, path):
    normalized = path.rstrip("/")
    for prefix, handler in _ROUTES:
        if normalized == prefix or normalized.startswith(prefix + "/"):
            return lambda: handler(event, method, path)
    return None
```

This also removes the five `_is_*_path()` functions.

**Files to modify:**
- `backend/src/app/api/admin.py`

---

### B-ARCH-03 · MEDIUM — `_parse_body` does not convert JSON parse errors to ValidationError

**File:** `backend/src/app/api/admin_request.py` — `_parse_body()` (lines 15-22)

**Problem:**
If `json.loads(raw)` fails, it raises a raw `json.JSONDecodeError` (a subclass
of `ValueError`). This is caught by the `ValueError` handler in `_safe_handler`
(admin.py line 65), which returns `str(exc)` directly to the client — leaking
the raw error message which may contain request body content.

In contrast, `admin_assets.py`'s `_parse_optional_json_body()` (lines 460-482)
properly wraps JSON errors in a `ValidationError`.

**Fix:**
Wrap the `json.loads` call:

```python
def _parse_body(event: Mapping[str, Any]) -> dict[str, Any]:
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise ValidationError("Request body is not valid base64") from exc
    if not raw:
        raise ValidationError("Request body is required")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValidationError("Request body must be valid JSON") from exc
```

**Files to modify:**
- `backend/src/app/api/admin_request.py` — `_parse_body()`

---

### B-ARCH-04 · LOW — `update_asset` requires full payload (no partial update)

**File:** `backend/src/app/api/assets/assets_common.py` — `parse_update_asset_payload()` (lines 175-181)

**Problem:**
PUT update reuses `parse_create_asset_payload`, requiring all fields. The
comment acknowledges this is intentional ("to keep request handling
deterministic and avoid partial-update ambiguity"), but it creates UX friction
for API clients that want to change a single field.

**Fix (when ready):**
Implement PATCH semantics with an `_parse_partial_update_payload()` that only
validates and returns fields present in the request body. The existing
`AssetRepository.update_asset()` already supports `None` for unchanged fields.
This is a lower-priority enhancement — the current behavior is correct but
inflexible.

**Files to modify (when implemented):**
- `backend/src/app/api/assets/assets_common.py`
- `backend/src/app/api/assets/admin_assets.py`

---

### B-ARCH-05 · LOW — `_parse_path` in `admin_request.py` appears to be dead code

**File:** `backend/src/app/api/admin_request.py` — `_parse_path()` (lines 25-63)

**Problem:**
The `_parse_path` function handles admin/manager/user path parsing but is not
imported by any module. The route matching in `admin.py` uses `_is_*_path()`
functions, and the asset handlers use `split_route_parts()` from
`assets_common.py`. `_parse_path` and its helpers `_strip_version_prefix` and
`_is_version_segment` are likely leftover from an earlier routing approach.

**Fix:**
Verify no usages exist (search for `_parse_path`, `_strip_version_prefix`,
`_is_version_segment` imports). If confirmed unused, remove lines 25-75 from
`admin_request.py`.

**Files to modify:**
- `backend/src/app/api/admin_request.py`

---

## Category 4 — Test Coverage

### B-TEST-01 · HIGH — Minimal test coverage (6 test files for 54+ source modules)

**File:** `tests/` directory

**Problem:**
Only 6 test files exist, covering a small fraction of the backend:

| Test file                     | Covers                          |
|-------------------------------|---------------------------------|
| `test_asset_share_links.py`   | Share-link helpers               |
| `test_turnstile_service.py`   | Turnstile token verification    |
| `test_asset_enum_mapping.py`  | DB enum round-trips             |
| `test_response_utils.py`      | Content-Type validation         |
| `test_cloudfront_signing.py`  | CloudFront URL signing          |

**Major untested areas (in priority order):**

1. **Lambda authorizers** — JWT validation, group checking, policy generation
2. **API route dispatch** — `admin.py` router, method matching, 404/405 handling
3. **Asset endpoint handlers** — CRUD operations, access control, share links
4. **Database repositories** — query logic, pagination, grant filtering
5. **Request parsing** — body decoding, base64 handling, cursor encode/decode
6. **Admin validators** — phone validation, URL validation, language codes
7. **Audit logging** — context setting, entry creation, query methods
8. **AWS proxy service** — allow-list checking, request proxying
9. **Error handling paths** — exception-to-response mapping, edge cases
10. **SQS processor** — message parsing, idempotency, email dispatch

**Fix:**
Prioritize adding tests for areas 1-5. See B-TEST-02 for required
infrastructure.

**Files to create (suggested):**
- `tests/test_authorizers.py`
- `tests/test_admin_router.py`
- `tests/test_admin_assets.py`
- `tests/test_user_assets.py`
- `tests/test_public_assets.py`
- `tests/test_asset_repository.py`
- `tests/test_admin_request.py`
- `tests/test_admin_validators.py`
- `tests/test_audit.py`
- `tests/test_aws_proxy.py`
- `tests/test_manager_request_processor.py`

---

### B-TEST-02 · HIGH — No shared test fixtures or conftest infrastructure

**File:** `tests/conftest.py`

**Problem:**
The conftest only adds the backend source to `sys.path`. There are no shared
fixtures for common testing patterns.

**Fix:**
Expand `tests/conftest.py` with reusable fixtures:

```python
@pytest.fixture
def api_gateway_event():
    """Factory for API Gateway Lambda event dicts."""
    def _make(method="GET", path="/", body=None, headers=None,
              query_params=None, authorizer_context=None):
        event = {
            "httpMethod": method,
            "path": path,
            "headers": headers or {},
            "queryStringParameters": query_params,
            "multiValueQueryStringParameters": None,
            "body": body,
            "isBase64Encoded": False,
            "requestContext": {
                "requestId": "test-request-id",
                "authorizer": authorizer_context or {},
            },
        }
        return event
    return _make

@pytest.fixture
def admin_identity():
    """Authorizer context for an admin user."""
    return {
        "userSub": "test-admin-sub-12345",
        "email": "admin@example.com",
        "groups": "admin",
        "organizationIds": "org-1",
    }

@pytest.fixture
def mock_env(monkeypatch):
    """Helper to set multiple environment variables at once."""
    def _set(**kwargs):
        for key, value in kwargs.items():
            monkeypatch.setenv(key, value)
    return _set
```

Also add `moto` and `pytest-mock` to test dependencies (see B-TEST-03).

**Files to modify:**
- `tests/conftest.py`

---

### B-TEST-03 · MEDIUM — No test dependency management

**Problem:**
`backend/requirements.txt` only has runtime dependencies. No test dependencies
are defined anywhere. The project needs:

- `pytest` (used but not declared)
- `pytest-cov` (for coverage reporting)
- `pytest-mock` (for cleaner mocking patterns)
- `moto` (for AWS service mocking — S3, SQS, SES, Secrets Manager, Cognito)

**Fix:**
If implementing B-ARCH-01 (pyproject.toml), add a `[project.optional-dependencies]`
test group. Otherwise, create `backend/requirements-dev.txt`:

```
pytest>=8.0
pytest-cov>=5.0
pytest-mock>=3.14
moto[s3,ses,secretsmanager,sqs,cognitoidp]>=5.0
```

**Files to create:**
- `backend/requirements-dev.txt` (or add to `pyproject.toml`)

---

### B-TEST-04 · LOW — Tests use ad-hoc inline mocks instead of reusable fixtures

**Files:**
- `tests/test_cloudfront_signing.py` — defines `_DummySigner`, `_FakePrivateKey`
- `tests/test_turnstile_service.py` — defines inline lambda mocks

**Problem:**
Each test file creates its own mock objects for similar patterns. These could be
shared via conftest fixtures for consistency and reuse.

**Fix:**
Move common mocks (fake AWS clients, fake signers, fake event builders) into
`tests/conftest.py` as fixtures. Address as part of B-TEST-02.

**Files to modify:**
- `tests/conftest.py`
- `tests/test_cloudfront_signing.py`
- `tests/test_turnstile_service.py`

---

## Category 5 — Code Quality & Best Practices

### B-QUAL-01 · MEDIUM — Leading underscores on cross-module public functions

**Files:**
- `backend/src/app/api/admin_request.py` — exports `_parse_body`, `_parse_uuid`,
  `_encode_cursor`, `_parse_cursor`, `_query_param`, `_require_env`
- `backend/src/app/api/admin_validators.py` — exports `_validate_string_length`,
  `_validate_email`

**Problem:**
These functions are imported by other modules (`admin_assets.py`,
`user_assets.py`, `public_assets.py`, `public_reservations.py`,
`assets_common.py`) but use leading underscores suggesting private scope. This
violates Python naming conventions and confuses IDE tooling (linters may warn
about importing private symbols).

**Fix:**
Rename by removing the leading underscore from all functions that are imported
cross-module. Update all import sites. Use `replace_all` for renaming.

Affected functions and their new names:

| Current name                | New name                  | File                   |
|-----------------------------|---------------------------|------------------------|
| `_parse_body`               | `parse_body`              | `admin_request.py`     |
| `_parse_uuid`               | `parse_uuid`              | `admin_request.py`     |
| `_encode_cursor`            | `encode_cursor`           | `admin_request.py`     |
| `_parse_cursor`             | `parse_cursor`            | `admin_request.py`     |
| `_query_param`              | `query_param`             | `admin_request.py`     |
| `_require_env`              | `require_env`             | `admin_request.py`     |
| `_validate_string_length`   | `validate_string_length`  | `admin_validators.py`  |
| `_validate_email`           | `validate_email`          | `admin_validators.py`  |

**Files to modify:**
- `backend/src/app/api/admin_request.py`
- `backend/src/app/api/admin_validators.py`
- `backend/src/app/api/assets/admin_assets.py`
- `backend/src/app/api/assets/user_assets.py`
- `backend/src/app/api/assets/public_assets.py`
- `backend/src/app/api/assets/assets_common.py`
- `backend/src/app/api/public_reservations.py`

---

### B-QUAL-02 · MEDIUM — Inconsistent return type annotations across API handlers

**Files:**
- `backend/src/app/api/assets/admin_assets.py` — uses `dict[str, Any]`
- `backend/src/app/api/assets/share_assets.py` — uses `dict[str, Any]`
- `backend/src/app/api/assets/user_assets.py` — uses `dict[str, object]`
- `backend/src/app/api/assets/public_assets.py` — uses `dict[str, object]`

**Problem:**
Two handlers annotate returns as `dict[str, Any]` and two as `dict[str, object]`.
Both are correct but the inconsistency makes the code look unpolished and can
confuse type checkers.

**Fix:**
Standardize all API handler return types to `dict[str, Any]` (since responses
contain nested dicts, lists, and mixed types that `object` does not express
well). Replace `dict[str, object]` and `Mapping[str, object]` with
`dict[str, Any]` and `Mapping[str, Any]` in `user_assets.py` and
`public_assets.py`.

**Files to modify:**
- `backend/src/app/api/assets/user_assets.py`
- `backend/src/app/api/assets/public_assets.py`

---

### B-QUAL-03 · MEDIUM — Mixed `Optional[X]` and `X | None` type annotation styles

**Problem:**
The codebase inconsistently mixes:
- `from typing import Optional` + `Optional[str]` — used in `base.py`,
  `engine.py`, `audit.py`, `admin_request.py`, `parsers.py`, `validators.py`,
  `assets_common.py`
- `str | None` — used in `share_links.py`, `aws_proxy.py`, `aws_clients.py`,
  `share_assets.py`

All files have `from __future__ import annotations` so both styles are
syntactically valid, but mixing them in the same codebase is inconsistent.

**Fix:**
Standardize on the modern `X | None` syntax. In each affected file:
1. Replace `Optional[X]` with `X | None`.
2. Remove unused `from typing import Optional` imports.

**Files to modify (partial list — all files using `Optional`):**
- `backend/src/app/db/repositories/base.py`
- `backend/src/app/db/engine.py`
- `backend/src/app/db/audit.py`
- `backend/src/app/db/connection.py`
- `backend/src/app/api/admin_request.py`
- `backend/src/app/api/assets/assets_common.py`
- `backend/src/app/utils/parsers.py`
- `backend/src/app/utils/validators.py`
- `backend/src/app/utils/responses.py`
- `backend/src/app/utils/logging.py`
- `backend/src/app/exceptions.py`
- `backend/src/app/services/cloudfront_signing.py`
- `backend/src/app/services/email.py`

---

### B-QUAL-04 · LOW — Standard library imports inside function body unnecessarily

**File:** `backend/src/app/db/audit.py` — `serialize_for_audit()` (lines 470-473)

**Problem:**
```python
def serialize_for_audit(entity, exclude_fields=None):
    import enum
    from decimal import Decimal
    from uuid import UUID as UUIDType
```

These are standard library modules with negligible import cost. Lazy imports are
justified for heavy third-party packages to reduce Lambda cold-start time, but
`enum`, `decimal`, and `uuid` are already loaded by the Python runtime.

**Fix:**
Move `import enum`, `from decimal import Decimal`, and
`from uuid import UUID` to the module-level imports.

**Files to modify:**
- `backend/src/app/db/audit.py`

---

### B-QUAL-05 · LOW — `func` import inside method body in `BaseRepository.count()`

**File:** `backend/src/app/db/repositories/base.py` — `count()` (lines 148-149)

**Problem:**
```python
def count(self) -> int:
    from sqlalchemy import func
    result = self._session.execute(select(func.count()).select_from(self._model))
```

`sqlalchemy.func` is used at module level in `asset.py` and is always loaded in
any Lambda handler that accesses the database. The lazy import is unnecessary.

**Fix:**
Add `from sqlalchemy import func` to the module-level imports (alongside the
existing `from sqlalchemy import select`). Remove the in-method import.

**Files to modify:**
- `backend/src/app/db/repositories/base.py`

---

## Category 6 — Operational & Reliability

### B-OPS-01 · MEDIUM — No retry logic for transient AWS API failures in non-migration handlers

**Files:**
- `backend/lambda/api_key_rotation/handler.py`
- `backend/lambda/manager_request_processor/handler.py` (email sending)
- `backend/src/app/services/cloudfront_signing.py` (secret loading)

**Problem:**
The `migrations/utils.py` has a proper `_run_with_retry()` function with
exponential backoff for transient failures. However, other handlers that call
AWS APIs (API Gateway key rotation, SES email sending, Secrets Manager reads)
have no retry logic. Transient throttling or network errors cause hard failures.

**Fix:**
Extract the retry logic from `migrations/utils.py` into a shared utility
(e.g., `backend/src/app/utils/retry.py`) and apply it to critical AWS API calls
in the affected handlers. The retry function should:

- Accept a callable, max attempts, and base delay
- Retry on `botocore.exceptions.ClientError` with retryable error codes
- Retry on `ConnectionError` and `TimeoutError`
- Use exponential backoff with jitter

**Files to create:**
- `backend/src/app/utils/retry.py`

**Files to modify:**
- `backend/lambda/api_key_rotation/handler.py`
- `backend/lambda/manager_request_processor/handler.py`
- `backend/lambda/migrations/utils.py` (refactor to use shared utility)

---

### B-OPS-02 · LOW — Secret cache has no TTL or invalidation

**File:** `backend/src/app/services/secrets.py`

**Problem:**
```python
_SECRET_CACHE: dict[str, dict[str, Any]] = {}

def get_secret_json(secret_arn: str) -> dict[str, Any]:
    if secret_arn in _SECRET_CACHE:
        return _SECRET_CACHE[secret_arn]
    # ... fetch and cache forever
```

The secrets cache persists for the entire lifetime of a Lambda container
(potentially hours). If a secret is rotated (e.g., database credentials), the
Lambda uses stale values until the container is recycled. The CloudFront signer
in `cloudfront_signing.py` already implements a proper TTL-based cache pattern
(lines 59-89) that could serve as a model.

**Fix:**
Add a monotonic-time-based TTL to the secret cache, similar to the signer cache:

```python
@dataclass(frozen=True)
class _CacheEntry:
    value: dict[str, Any]
    loaded_at: float

_SECRET_CACHE: dict[str, _CacheEntry] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes

def get_secret_json(secret_arn: str) -> dict[str, Any]:
    entry = _SECRET_CACHE.get(secret_arn)
    if entry and (time.monotonic() - entry.loaded_at) <= _CACHE_TTL_SECONDS:
        return entry.value
    # ... fetch, wrap in _CacheEntry, cache
```

**Files to modify:**
- `backend/src/app/services/secrets.py`

---

## Priority Summary

| Priority | Count | IDs |
|----------|-------|-----|
| **HIGH** | 4 | B-SEC-01, B-DUP-01, B-TEST-01, B-TEST-02 |
| **MEDIUM** | 12 | B-SEC-02, B-SEC-03, B-DUP-02, B-DUP-03, B-ARCH-01, B-ARCH-02, B-ARCH-03, B-TEST-03, B-QUAL-01, B-QUAL-02, B-QUAL-03, B-OPS-01 |
| **LOW** | 7 | B-DUP-04, B-ARCH-04, B-ARCH-05, B-TEST-04, B-QUAL-04, B-QUAL-05, B-OPS-02 |

---

## Recommended Implementation Order

Implement in this sequence to maximize impact while minimizing risk:

1. **B-SEC-01** — Remove error detail leak (1 line change, immediate security win)
2. **B-ARCH-03** — Wrap `_parse_body` JSON errors (prevents body-content leak)
3. **B-DUP-01 + B-SEC-02** — Extract authorizer shared code (reduces 120 lines,
   eliminates security drift)
4. **B-DUP-02** — Consolidate `_use_iam_auth()`
5. **B-DUP-03** — Consolidate `_required_env()` with `ConfigurationError`
6. **B-QUAL-01** — Remove leading underscores from cross-module functions
7. **B-SEC-03** — Fix query parameter double-counting
8. **B-TEST-02 + B-TEST-03** — Add test infrastructure (conftest, dependencies)
9. **B-TEST-01** — Build out test coverage for critical paths
10. **B-ARCH-02** — Refactor route dispatch to declarative table
11. **B-QUAL-02 + B-QUAL-03** — Standardize type annotations
12. **B-OPS-01** — Extract and apply shared retry logic
13. **B-DUP-04** — Extract pagination helper
14. **B-ARCH-01** — Add `pyproject.toml`
15. **B-ARCH-05** — Remove dead code
16. **B-QUAL-04 + B-QUAL-05** — Move lazy stdlib imports to module level
17. **B-OPS-02** — Add TTL to secret cache
18. **B-ARCH-04** — Implement partial update (PATCH) support
19. **B-TEST-04** — Consolidate test mocks into fixtures
