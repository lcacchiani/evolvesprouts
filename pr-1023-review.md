# Review: PR #1023 — cursor/public-endpoints-list-766e

Assessment of branch `cursor/public-endpoints-list-766e` (PR #1023).
Two commits, 30 files changed (+209 / -127 lines).

## Rename map

| Old path | New path |
|----------|----------|
| `GET /v1/client-resources` | `GET /v1/assets/free` |
| `GET /www/v1/client-resources` | `GET /www/v1/assets/free` |
| `POST /v1/media-request` | `POST /v1/assets/public/free/request` |
| `POST /www/v1/media-request` | `POST /www/v1/assets/public/free/request` |
| `GET /v1/calendar/events` | `GET /v1/calendar/public` |
| `GET /www/v1/calendar/events` | `GET /www/v1/calendar/public` |

## Issues

### 1. HIGH — `_path_matches` hardcoded exclusion is fragile

The media-request handler moved from standalone `/v1/media-request` into the
`/v1/assets/public/free/request` tree, which lives under the existing prefix
route `/v1/assets/public` (exact=False). To prevent prefix-match from
swallowing paths like `/v1/assets/public/free/...`, a hardcoded exclusion was
added:

```python
if route_path == "/v1/assets/public" and path.startswith("/v1/assets/public/free/"):
    return False
```

This is brittle because:
- It only guards `/v1/assets/public`, not the `/www/` variant (currently not a
  prefix route, but if one is ever added it would silently break).
- It couples the generic path matcher to a specific route name. If another
  nested exact route is added under `/v1/assets/public/` in the future, the
  same pattern must be repeated.
- A more robust approach would be to iterate remaining exact routes to see if a
  more-specific match exists before accepting a prefix match, or to place the
  prefix route AFTER all its nested exact children and rely solely on
  first-match-wins ordering (which is already the case here — but the
  exclusion exists as belt-and-suspenders, and it's the suspenders that have
  the fragility).

### 2. MEDIUM — No backward compatibility for removed paths

The old paths (`/v1/client-resources`, `/v1/media-request`,
`/v1/calendar/events` and their `/www/` variants) are removed from CDK, the
Lambda router, and the CloudFront allowlist in one step.

Any external consumer, cached client, or in-flight request using the old paths
will receive 404 immediately after deployment. There is no deprecation period,
redirect, or dual-registration.

For purely internal endpoints this may be acceptable, but it should be a
conscious deployment decision. Consider whether the old paths should remain
temporarily with a redirect or alias.

### 3. MEDIUM — CloudFront behavior key rename is a destructive infra change

```typescript
// Old
"www/v1/media-request": { origin: mediaRequestApiOrigin, ... }
// New
"www/v1/assets/public/free/request": { origin: mediaRequestApiOrigin, ... }
```

Changing the `additionalBehaviors` key causes CloudFront to delete the old
behavior and create a new one during CDK deploy. During the transition window,
media-request POST traffic through CloudFront may fail. This needs coordinated
deployment (backend CDK first, then public_www config, and monitoring during
the switchover).

### 4. MEDIUM — File and symbol names not updated to match new paths

- `backend/src/app/api/public_client_resources.py` — still named
  "client_resources" while the endpoint is now `/v1/assets/free`.
- `handle_public_client_resources_request` function name.
- `tests/test_public_client_resources_api.py` — same stale naming.

These work correctly but create a naming inconsistency between code artifacts
and API paths. Could be deferred to a follow-up, but should be tracked.

### 5. LOW — Confusing double use of "free" in the asset path tree

The CDK resource tree under `/v1/assets` now has:

```
/v1/assets/free         (GET — list free website assets)
/v1/assets/public/free  (subtree)
  /request              (POST — media lead form)
```

"free" appears at two different tree depths with different meanings:
- `/v1/assets/free` = free-to-access client documents
- `/v1/assets/public/free/request` = request for free media assets

This is not a bug, but the naming could confuse developers reading the API
surface.

### 6. LOW — OpenAPI version jumps from 0.2.0 to 0.2.2

Skips 0.2.1. Minor cosmetic issue but may confuse changelog consumers.

### 7. INFO — OpenAPI adds `/v1/calendar/public` as a new documented path

The old spec only documented `/www/v1/calendar/events` (the website proxy
path). The rename also adds `GET /v1/calendar/public` as a new documented
direct-API path. This is a documentation improvement, not just a rename.

## What's done well

- **Thorough coverage**: all 6 old paths are consistently renamed across CDK
  API Gateway resources, CloudFront allowlist and media-request behavior,
  Lambda router, handler docstrings, OpenAPI specs, 10 architecture docs,
  README, smoke test script, frontend path constants, and all affected test
  files.
- **Router tests extended**: `test_admin_router.py` adds both positive and
  negative path-match assertions for the new paths, including the
  `/extra`-suffix rejection cases.
- **`_is_free_assets_list_path` tightened**: the old version-flexible matching
  (`/vN/client-resources`) is replaced with exact `/v1/assets/free` matching,
  reducing unintended path acceptance.
- **CDK resource tree is correct**: no AWS API Gateway resource name
  collisions; `free` under `assets` and `free` under `public` are at different
  tree levels and deploy cleanly.
