# Architecture Decisions

This document captures the agreed architecture decisions for the
Flutter mobile app, Next.js admin console, and AWS serverless backend.

## 1) Admin Web Router

**Decision:** Use Next.js App Router (React Server Components).

**Why:**
- Modern Next.js architecture (RSC, streaming, Suspense).
- Better performance and SSR defaults.
- Improved DX (layouts, loading, error boundaries).
- Best TypeScript support and forward compatibility.

**Canonical structure:**
- `apps/admin_web/src/app/...` with route groups and nested layouts.

## 2) Infrastructure as Code

**Decision:** AWS CDK (TypeScript) + CDK Pipelines.

**Why:**
- TypeScript-first IaC aligned with the frontend stack.
- Full AWS construct coverage and strong integration.
- Programmatic abstractions (loops, conditions, helpers).
- Self-mutating pipelines with approval gates and rollbacks.

**Canonical structure:**
- `backend/infrastructure/` contains CDK app, stacks, and pipeline.
- Deploy workflows detect and reuse existing database resources and VPCs
  to avoid replacements.
- Imports use environment variables for existing resource identifiers,
  including security groups and Secrets Manager references.

## Database schema (Aurora PostgreSQL)

**Decisions:**
- Geographic filtering uses `locations.area_id` (FK to `geographic_areas`).
- Times are stored in UTC.
- DB changes are versioned with Alembic.
- Lambda connections use RDS Proxy for connection pooling.
- RDS Proxy uses IAM authentication; Lambda generates IAM tokens.
- IAM DB roles `evolvesprouts_app` (read) and `evolvesprouts_admin` (write)
  are created via migrations and granted `rds_iam`.
- DB connections enforce TLS and use small pools tuned for Lambda.
- Migrations Lambda uses password auth directly against the cluster endpoint.

**Core tables:**
- `locations`
- `geographic_areas`
- `assets`
- `asset_access_grants`
- `audit_log`

**Migrations:**
- Alembic config and migrations live in `backend/db/`.
- Seed data lives in `backend/db/seed/seed_data.sql`.

## Unified CRM notes storage

**Decision:** Store all CRM notes (standalone contact notes, lead-attached notes, and
legacy mysqldump imports) in a single `notes` table with explicit FK columns to
contacts, families, organizations, and sales leads.

**Why:** The previous split (`crm_notes` vs polymorphic `notes` + `note_entity_links`)
duplicated concepts and complicated imports. One table keeps the model coherent,
lets legacy import target the same storage as interactive CRM notes, and preserves
`legacy_import_refs` mapping (legacy `note.id` → first inserted row when a note
links multiple contacts).

**Migration:** `0028_unify_notes_storage` backfills polymorphic contact-linked rows,
drops the old polymorphic tables, renames `crm_notes` → `notes`, and adds nullable
`took_at` for legacy provenance (not exposed in the admin API).

## API Contracts

**Decisions:**
- OpenAPI contracts live under `docs/api/` and are the single source
  of truth for all API endpoint details (paths, methods, parameters,
  request/response schemas, authentication requirements).
- Currently wired API Gateway contract: [`docs/api/admin.yaml`](../api/admin.yaml).
- Public endpoint contract: [`docs/api/public.yaml`](../api/public.yaml).
- API client generation is handled via generalized scripts in
  `scripts/codegen/`.
- **Do not duplicate endpoint details in architecture docs.** Always
  link to the OpenAPI specs instead.

## Lambda Implementation

**Decisions:**
- Lambda entrypoints live under `backend/lambda/**`.
- Shared application code lives under `backend/src/app`.
- Python dependencies are listed in `backend/requirements.txt`.
- Database migrations and seed are executed during CDK deploy
  via a custom resource Lambda.
- Lambda packaging is deterministic (no bytecode) to reduce no-op deploys.

## Authentication

**Decisions:**
- Public asset routes use API key + device attestation; admin asset
  routes require Cognito `admin` group; user asset routes require
  any valid JWT.
- Admin and manager groups are created via CDK.
- Admin bootstrap user can be created with CDK parameters.
- Authentication is passwordless: email custom challenge (OTP + optional magic
  link) and federated sign-in via Google (OIDC).
- Device attestation validates JWTs against a JWKS URL configured in CDK
  parameters.
- Hosted UI uses OAuth code flow with callback/logout URLs supplied via CDK
  parameters.
- API keys are rotated every 90 days by a scheduled Lambda.
- API Gateway method caching enabled for public asset listing (`/v1/assets/public`,
  5-minute TTL).
- See the OpenAPI specs for per-endpoint authentication requirements:
  [`docs/api/admin.yaml`](../api/admin.yaml).

## AWS / HTTP Proxy

**Decision:** Use a generic proxy Lambda outside the VPC instead of per-service
Lambdas or NAT Gateway.

**Why:**
- Cognito disables PrivateLink when ManagedLogin is configured on the User Pool,
  so a `cognito-idp` VPC endpoint cannot be used.
- A NAT Gateway is expensive (~$45/month per AZ) for occasional API calls.
- A per-service Lambda (e.g. dedicated Cognito Lambda) duplicates routing,
  auth, and business logic.

**How:**
- `AwsApiProxyFunction` runs outside the VPC and accepts two request types:
  - `type: "aws"` – executes a boto3 call (e.g. `cognito-idp:list_users`)
  - `type: "http"` – makes an outbound HTTP request to an external API
- Requests are validated against environment-variable allow-lists:
  - `ALLOWED_ACTIONS` for AWS API calls (`service:action` pairs)
  - `ALLOWED_HTTP_URLS` for HTTP requests (URL prefixes)
- In-VPC Lambdas invoke the proxy via Lambda-to-Lambda (requires a Lambda VPC
  endpoint).
- Client helpers in `backend/src/app/services/aws_proxy.py`:
  - `invoke(service, action, params)` for AWS calls
  - `http_invoke(method, url, headers, body, timeout)` for HTTP calls
- Current consumers include Cognito admin operations, Turnstile verification,
  Mailchimp sync, and expense invoice parsing (OpenRouter).

**Security:**
- IAM role scoped to specific AWS actions on specific resources.
- Allow-lists prevent the proxy from being used for unintended operations.
- Only Lambdas explicitly granted `lambda:InvokeFunction` can call the proxy.

## Flutter Amplify Configuration

**Decisions:**
- Amplify config is passed via `--dart-define=AMPLIFY_CONFIG=...`.
- API name is set with `--dart-define=AMPLIFY_API_NAME=...`.

## 3) CI/CD Authentication

**Decision:** GitHub Actions OIDC + IAM role assumption.

**Why:**
- No long-lived AWS keys stored in GitHub.
- Short-lived credentials with automatic rotation.
- Fine-grained IAM permissions and auditability.

## 4) Mobile Distribution

**Decision:** Android AAB + iOS App Store Connect/TestFlight.

**Why:**
- Google Play requires AAB for production.
- App Store Connect + TestFlight for production and beta.

**Notes:**
- CI uploads AAB to Play Console when service account secrets are set.
- Android signing uses a keystore injected at build time in CI.
- Android signing templates live in `apps/evolvesprouts_app/android/`.
- CI uploads IPA to TestFlight when App Store API keys are set.
- iOS signing uses Fastlane match with a private certificates repo.
- Fastlane config lives in `apps/evolvesprouts_app/ios/fastlane`.
- iOS export settings are templated at
  `apps/evolvesprouts_app/ios/ExportOptions.plist.template`
  and generated in CI.

## 5) Amplify Usage

**Decision:** Use Amplify for client SDKs and hosting where appropriate.

**Notes:**
- Amplify SDKs are used for auth/API integration on client apps.
- Infrastructure is provisioned via CDK for stronger control.
- Admin web hosting is triggered via GitHub Actions using
  `aws amplify start-job`.
- Promotions from staging to production are handled via the
  `amplify-promote` workflow.
- The `amplify-promote` workflow uses the production environment to
  support GitHub approval gates.

## 6) Public Website Release Promotion (S3 + CloudFront)

**Decision:** Use immutable artifact promotion from staging to production for
`apps/public_www`.

**Why:**
- Guarantees production receives the exact artifact validated on staging.
- Avoids drift between staging verification and production rollout.
- Supports deterministic rollback by re-promoting a previous release ID.

**Notes:**
- Public Website stack: `evolvesprouts-public-www`
- Staging URL: `www-staging.evolvesprouts.com`
- Production URL: `www.evolvesprouts.com`
- The stack owns separate staging and production S3 + CloudFront assets.
- Pushes to `main` deploy to staging and store artifact snapshots under
  `releases/<release_id>/`.
- Staging deploys update `releases/latest-release-id.txt` to track the most
  recent validated staging build.
- Manual promotion copies `releases/<release_id>/` from staging bucket to
  production bucket root and invalidates production CloudFront.
- Promotion workflow supports either an explicit `release_id` or
  `latest_staging` mode.
- Staging adds `X-Robots-Tag: noindex, nofollow, noarchive` at CloudFront.

## 7) Lockfile Enforcement

**Decision:** Lockfiles are required and validated in CI.

**Notes:**
- Flutter: `pubspec.lock`
- Node.js: `package-lock.json`
- iOS: `Podfile.lock`
- CI workflow: `.github/workflows/check-lockfiles.yml`

## 8) Dependency Updates

**Decision:** Use Dependabot for automated dependency updates.

**Why:**
- Automatic security vulnerability alerts and patches.
- Small, frequent updates are easier to review than large version jumps.
- PR-based workflow integrates with existing CI checks.
- Low maintenance overhead once configured.

**Configuration (`.github/dependabot.yml`):**
- GitHub Actions, npm, pip, and pub ecosystems covered.
- Weekly schedule (Mondays) to reduce PR noise.
- Dependencies grouped by category (AWS CDK, Firebase, database, etc.).
- Major version updates ignored to require manual review.
- PRs labeled by ecosystem (`dependencies`, `ci`, `backend`, `mobile`, `infrastructure`).

**Dependabot commands:**
- `@dependabot merge` - Merge when CI passes.
- `@dependabot ignore this major version` - Stop updates for this major version.
- `@dependabot ignore this dependency` - Stop all updates for this dependency.

## 9) GitHub Rulesets

**Decision:** Protect `main` branch and release tags with GitHub rulesets.

**Why:**
- Prevents accidental direct pushes to production branch.
- Enforces code review before merging.
- Ensures CI checks pass before deployment.
- Protects release tags from modification or deletion.

**Branch protection for `main`:**
- Require pull request with at least 1 approval.
- Require `lint` and `test` status checks to pass.
- The `lint` workflow includes `.cursorrules` contract validation via
  `scripts/validate-cursorrules.sh`.
- Require branches to be up to date before merging.
- Block force pushes and deletions.

**Tag protection:**
- Protect `v*` tags from deletion and modification.

**Verification:**
- Weekly CI workflow (`.github/workflows/verify-rulesets.yml`) validates configuration.
- See `docs/architecture/github-rulesets.md` for setup instructions.

## 10) Web Analytics (Google Tag Manager)

**Decision:** Use Google Tag Manager with a runtime hostname allowlist gate.

**Why:**
- GTM provides a single container for GA4 and future marketing tags without
  code changes.
- Runtime hostname check preserves the immutable artifact promotion model --
  the same HTML serves staging and production.
- Zero analytics footprint on non-production hosts (no `dataLayer`, no network
  requests, no tracking).

**How:**
- The GTM container ID is baked into the HTML at build time via
  `NEXT_PUBLIC_GTM_ID` (stored as a GitHub Actions variable).
- An optional host allowlist is provided via `NEXT_PUBLIC_GTM_ALLOWED_HOSTS`
  (comma-separated hostnames). When unset, the gate defaults to the hostname
  from `NEXT_PUBLIC_SITE_ORIGIN`.
- `apps/public_www/public/scripts/init-gtm.js` reads `data-gtm-id` and
  `data-gtm-allowed-hosts` from the `<html>` element and checks
  `window.location.hostname`.
- GTM initializes only when the current hostname is in the configured
  allowlist.
- The build-time CSP injection (`inject-csp-meta.mjs`) conditionally adds
  Google domains to `script-src` and `connect-src` when GTM is detected in
  the build output.

**Security:**
- No `<noscript>` iframe is rendered (avoids analytics hits from JS-disabled
  clients on staging).
- CSP Google domain allowlists are only included when the GTM bootstrap
  script is present in the HTML.

## 11) Asset Download Delivery and Stable Share Links

**Decision:** Use CloudFront-signed URLs for asset downloads and keep stable
share URLs as database-backed bearer tokens.

**Why:**
- S3 presigned URLs have strict validity limits and do not satisfy long-lived
  sharing requirements.
- Stable links must remain constant while still supporting revoke/rotate
  controls after accidental exposure.
- CloudFront signed URLs provide cryptographic validation while allowing
  long expiry windows.

**How:**
- `asset_share_links` stores one stable token per asset.
- Admin APIs create/reuse, rotate, and revoke each asset token.
- Public route `/v1/assets/share/{token}` resolves the token and redirects to
  a fresh CloudFront-signed URL for the underlying S3 object.
- Public route `/v1/assets/email-download/{token}` uses the same token lookup and
  redirect but omits the Referer/Origin allowlist check for email client flows.
- API Gateway enforces an API key on these routes and the media CloudFront
  behaviors inject `x-api-key` at origin so browser users do not need to
  provide credentials directly.
- Each share link stores an admin-managed `allowed_domains` list; resolution on
  `/v1/assets/share/{token}` is denied unless Referer/Origin matches one of the
  configured domains.
- Share links that resolve to `restricted` assets also require a valid Cognito
  JWT on both paths, preserving the "restricted means logged-in" rule.
- CloudFront public key material is configured in infrastructure; matching
  private key material is stored in AWS Secrets Manager and loaded by Lambda.

## 12) Admin Web Section Ordering

**Decision:** In admin web screens, edit/create sections must appear above list
sections.

**Why:**
- Keeps primary task flow consistent with the established Siutindei admin
  interaction pattern.
- Makes the edit context visible before browsing/filtering lists.
- Reduces visual jumps when switching selected items.

**Notes:**
- Apply this ordering to newly built admin pages and when refactoring existing
  screens.
- Service management follows this pattern by rendering Service detail before the
  Services list.

## CI/CD Variables and Secrets

**GitHub Variables**
- `AWS_ACCOUNT_ID`
- `AWS_REGION`
- `CDK_STACKS` (optional; `all stacks`, `backend`, `admin web`, or `public website`)
- `CDK_BOOTSTRAP_QUALIFIER` (optional)
- `CDK_PARAM_FILE` (optional path to CDK parameter JSON)
- `NEXT_PUBLIC_API_BASE_URL` (Admin and Public WWW API base URL)
- `NEXT_PUBLIC_WWW_PROXY_ALLOWED_HOSTS` (Public WWW hostname allowlist for same-origin `/www` proxy rewrites)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Public WWW Turnstile site key)
- `NEXT_PUBLIC_FPS_MERCHANT_NAME` (Public WWW FPS merchant label)
- `NEXT_PUBLIC_FPS_MOBILE_NUMBER` (Public WWW FPS recipient number)
- `NEXT_PUBLIC_GTM_ID` (Google Tag Manager container ID, e.g. `GTM-XXXXXXX`)
- `NEXT_PUBLIC_GTM_ALLOWED_HOSTS` (optional comma-separated hostname
  allowlist for GTM runtime gating; defaults to `NEXT_PUBLIC_SITE_ORIGIN` host)
- `NEXT_PUBLIC_EMAIL` (maintenance page email)
- `NEXT_PUBLIC_WHATSAPP_URL` (maintenance page WhatsApp link)
- `NEXT_PUBLIC_INSTAGRAM_URL` (maintenance page Instagram link)
- `AMPLIFY_APP_ID`
- `AMPLIFY_BRANCH`
- `ANDROID_RELEASE_TRACK`
- `IOS_BUNDLE_ID`
- `APPLE_TEAM_ID`
- `IOS_PROVISIONING_PROFILE` (optional)
- `FIREBASE_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_ANDROID_APP_ID`
- `FIREBASE_IOS_APP_ID`
- `FIREBASE_IOS_BUNDLE_ID`
- `FIREBASE_STORAGE_BUCKET` (optional)
- `FIREBASE_APP_CHECK_DEBUG` (optional; "true" for debug providers)

**GitHub Secrets**
- `AMPLIFY_API_KEY` (mobile API key injected at build time)
- `CDK_PARAM_GOOGLE_CLIENT_SECRET`
- `CDK_PARAM_PUBLIC_API_KEY_VALUE`
- `CDK_PARAM_ADMIN_BOOTSTRAP_TEMP_PASSWORD` (optional)
- `NEXT_PUBLIC_WWW_CRM_API_KEY` (Public WWW browser API key)
- `APPSTORE_API_KEY_JSON` (recommended single JSON secret with issuer_id,
  key_id, private_key)
- `GOOGLE_PLAY_SERVICE_ACCOUNT`
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `APPSTORE_API_KEY_JSON`
- `APPSTORE_ISSUER_ID`
- `APPSTORE_API_KEY_ID`
- `APPSTORE_API_PRIVATE_KEY`
- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `FASTLANE_USER`
- `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD`

**CDK Parameters (via `CDK_PARAM_FILE`)**
- `PublicApiKeyValue` (API key required for public asset routes)
- `DeviceAttestationJwksUrl`, `DeviceAttestationIssuer`, `DeviceAttestationAudience`
- `AssetDownloadCloudFrontPublicKeyPem`
- `AssetDownloadCloudFrontPrivateKeySecretArn`

## Public website: remove legacy CRM API bridge

**Decision:** Retire `/v1/legacy/*` proxy routes and the `LEGACY_PUBLIC_API_*`
configuration. `public_www` calls native Aurora-backed handlers:
`POST /v1/contact-us`, `POST /v1/reservations`, and existing
`POST /v1/discounts/validate`.

**Why:**
- Single source of truth in Aurora for contacts and sales leads.
- Fewer moving parts (no outbound legacy HTTP from the admin Lambda).
- Aligns transactional email and Mailchimp hooks with persisted data.

**Non-production safety:** `DEPLOYMENT_STAGE` gates outbound SES, Mailchimp, and
SNS media publishes in non-production environments (see `deployment.py` and CDK
`DEPLOYMENT_STAGE` on the admin and media-processor Lambdas). The API stack
defaults this to `production`; override with **`CDK_DEPLOYMENT_STAGE=staging`**
at synth time for explicit non-prod stacks.

## Replace service-key env map with `services.slug`

**Decision:** Store optional lowercase referral slugs on `services.slug` with a
case-insensitive unique index, and resolve public `service_key` / booking
`course_slug` values against Aurora instead of a Lambda JSON env map.

**Why:** The database already owns service identity; slug is a first-class admin
field and avoids deploy-time JSON drift. Public discount validate/redeem paths
query `ServiceRepository.get_by_slug` in-session.

## Vendors API merged into organizations

**Decision:** Retire dedicated `/v1/admin/vendors` routes. Vendor rows remain
`organizations` rows with `relationship_type=vendor`. The admin console and API
clients list and edit them via `GET|POST|PATCH /v1/admin/organizations` with
`relationship_type=vendor` on list queries where needed.

**Why:** One resource model avoids duplicate CRUD paths, matches the database,
and simplifies OpenAPI and CDK wiring. Shared CRM helpers (`admin_crm_helpers.py`,
`admin_crm_serializers.py`) stay named for cross-entity reuse; organization-specific
modules use neutral `admin_organizations*.py` names.

**Payload shape:** The organizations create/update schemas are a superset of the
legacy vendor-only API. The Finance vendors UI is expected to send only
`organization_type: other`, `relationship_type: vendor`, `name`, `website`, and
`active` for vendor rows; the backend does not enforce a narrower vendor-only
subset for authenticated callers.

**CRM default list:** Unfiltered `GET /v1/admin/organizations` excludes vendor
rows so Contacts → Organizations matches picker and member-assignment rules;
Finance passes `relationship_type=vendor` for the vendors table.

## Keeping Documentation Up to Date

**Decision:** Architecture documentation in `docs/architecture/` describes
high-level design, patterns, and decisions. API endpoint details (paths,
methods, parameters, schemas) are documented exclusively in the OpenAPI
specs under `docs/api/`. Architecture docs must link to the OpenAPI specs
rather than duplicating endpoint information.

When making changes:
1. Update the relevant OpenAPI spec if adding/changing endpoints.
2. Update `docs/architecture/lambdas.md` if adding/changing Lambda functions.
3. Update `docs/architecture/database-schema.md` if adding/changing tables.
4. Update other architecture docs if design decisions or patterns change.
