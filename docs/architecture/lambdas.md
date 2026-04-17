# Lambda Catalog

This document lists the backend Lambda functions, their handlers, and
their primary responsibilities.

## Runtime and packaging

- Runtime: Python 3.12.
- Packaging: deterministic bundling (no bytecode files, repeatable output).
- CDK runs `backend/scripts/run-cdk-app.sh`, which builds the local
  bundle via `backend/scripts/build_lambda_bundle.py` before synth/deploy.
- Lambda dependency wheels are cached under
  `backend/.lambda-build/dependency-cache` keyed by `backend/requirements.txt`
  content and target runtime metadata to avoid reinstalling pip dependencies on
  every synth.
- Cache retention is bounded (default keeps the 3 most recent keys). Older
  cached dependency keys are pruned automatically by
  `backend/scripts/build_lambda_bundle.py`.

### CDK deploy parameter hygiene

- Discount validation and reservation flows resolve public `service_key` values from
  `services.slug` in Aurora. The legacy `PUBLIC_SERVICE_KEY_MAP_JSON` Lambda environment
  variable (and CDK `PublicServiceKeyMapJson` parameter) has been removed; production and
  staging deploys must not pass it in pipeline parameter files or `cdk deploy --parameters`
  invocations.

## API Gateway Lambdas

### Admin API
- Function: EvolvesproutsAdminFunction
- Handler: backend/lambda/admin/handler.py
- Trigger: API Gateway — currently wired for
  `/v1/assets/free/request`, `/v1/reservations`,
  `/v1/reservations/payment-intent`,
  `/v1/calendar/public`,
  `/v1/discounts/validate`,
  `/v1/contact-us`,
  `/v1/admin/geographic-areas`,
  `/v1/mailchimp/webhook` (GET/POST),
  `/v1/admin/locations/*` (including `POST /v1/admin/locations/geocode` for
  Nominatim-backed address geocoding via `AwsApiProxyFunction`),
  `/v1/admin/assets/*`,
  `/v1/admin/contacts/*` (including `GET /v1/admin/contacts/tags` for tag pickers and
  `GET /v1/admin/contacts/search` for contact picker search),
  `/v1/admin/families/picker`, `/v1/admin/families/*`,
  `/v1/admin/organizations/picker`, `/v1/admin/organizations/*` (CRM organisations excluding
  vendors; vendors remain under `/v1/admin/vendors`),
  `/v1/admin/leads/*`, `/v1/admin/users`, `/v1/admin/instructors`,
  `/v1/admin/services/*` (including `GET /v1/admin/services/instances` for
  cross-service instance listing with optional `service_id` / `service_type`
  filters), `/v1/admin/discount-codes/*` (`POST` returns `409` with `field: code` when
  the code collides with the case-insensitive unique index),
  `/v1/admin/vendors/*`,
  `/v1/admin/expenses/*`,
  `/v1/user/assets/*`,
  `/v1/assets/public/*`, `/v1/assets/share/*`, `/v1/assets/email-download/*`,
  and `GET /v1/assets/free`,
  plus public website proxy routes including
  `/www/v1/discounts/validate` (native Aurora-backed discount validation; optional
  `service_key` is resolved case-insensitively against `services.slug` in Aurora),
  `/www/v1/contact-us`, `/www/v1/reservations`,
  `/www/v1/calendar/public` (event instances include optional `slug` and
  `landing_page` from `service_instances`, and `spaces_total` / `spaces_left`
  when `max_capacity` is set, using the same enrollment statuses as capacity
  checks: registered, confirmed, completed),
  `/www/v1/assets/free` (lists public assets tagged `client_document`;
  optional `language` query filters on `assets.content_language` using any valid
  BCP 47-style tag; admin asset writes restrict `content_language` to `en`,
  `zh-CN`, or `zh-HK`; downloads
  remain on `/v1/assets/public/{id}/download` with device attestation)
- Auth: Cognito JWT — admin group for `/v1/admin/*`,
  any authenticated user for `/v1/user/*`,
  device attestation + API key for `/v1/assets/public/*`,
  API key for `/v1/assets/share/*` and `/v1/assets/email-download/*` (injected by
  media CloudFront at origin) and `GET /v1/assets/free`
- Permissions: SES `SendEmail` / `SendRawEmail` / `SendTemplatedEmail` on the
  verified `SesSenderEmail` identity **and** the `AuthEmailFromAddress` identity
  (plus derived domain identity ARNs), Secrets Manager read for the Mailchimp API
  secret when marketing hooks run on public form routes
- Environment (selected): `SES_SENDER_EMAIL`, `CONFIRMATION_EMAIL_FROM_ADDRESS`,
  `PUBLIC_WWW_BASE_URL`, optional `PUBLIC_WWW_INSTAGRAM_URL`,
  `PUBLIC_WWW_LINKEDIN_URL`, `PUBLIC_WWW_WHATSAPP_URL` (transactional email shell;
  align with public site `NEXT_PUBLIC_*` URLs; `wa.me/message/...` values are
  rewritten to `https://wa.me/<phone>` for reliable email clients),
  `PUBLIC_WWW_BUSINESS_PHONE_NUMBER` (used to build `wa.me/<digits>` links;
  align with `NEXT_PUBLIC_BUSINESS_PHONE_NUMBER`), `SUPPORT_EMAIL` (contact-us
  **contact_inquiry** internal notifications only), `COGNITO_USER_POOL_ID`,
  `ADMIN_GROUP`, `AWS_PROXY_FUNCTION_ARN` (sales recap recipient resolution via Cognito group),
  `SALES_RECAP_DISPLAY_TIMEZONE` (optional IANA id for recap **Submitted at**; CDK `SalesRecapDisplayTimezone` parameter, empty = app default),
  `MAILCHIMP_*` welcome journey vars (see `aws-messaging.md`)
- Purpose:   asset metadata CRUD (admin asset list returns `linked_tag_names` for tag
  filters and accepts `tag_name` for any tag linked to assets in the requested
  `asset_type` scope; create/update accept optional `client_tag` for the
  `client_document` tag, forbidden when the asset is expense-linked), geographic area browsing, location CRUD
  and geocoding (`POST /v1/admin/locations/geocode` uses `NOMINATIM_USER_AGENT` and
  `NOMINATIM_REFERER` with the HTTP proxy to OpenStreetMap's geocoder; the
  `countrycodes` parameter is built from the root area `code` plus the sovereign
  country row's `code` when `geographic_areas.sovereign_country_id` is set),
  (list supports optional `area_id`, `search` on address, cursor pagination, and `total_count`),
  CRM contact/family/organization management with soft-archive, locations, tags,
  and family/organization membership rows,
  sales pipeline lead management (list/detail/create/update/notes/export/analytics),
  vendor management, expense invoice ingestion/listing/amendment/void/pay flows
  (mark-paid requires vendor, invoice date, currency, and total), and admin-user
  listing for lead assignment and instructor-group listing for service instances
  (service list items may include nullable `training_details` for training courses),
  grant management,
  stable share-link lifecycle (read/create/rotate/revoke + domain allowlist
  policy), share-link source-domain enforcement, conditional JWT
  authentication for restricted share-link resolutions, PATCH partial metadata
  updates on `/v1/admin/assets/{id}`, media lead capture with Turnstile
  verification (via `AwsApiProxyFunction`) and SNS event publishing on
  `/v1/assets/free/request`, Mailchimp webhook ingestion and contact sync-status
  reconciliation on `/v1/mailchimp/webhook`, native public contact-us on
  `/v1/contact-us` (Turnstile + Aurora contact upsert; optional sales lead for
  `contact_inquiry`; post-success SES + Mailchimp + recaps via
  `run_contact_us_post_success`),
  Stripe PaymentIntent creation for
  inline public booking modal payments on `/v1/reservations/payment-intent`
  (card-only `payment_method_types[]=card`; wallet buttons are disabled in the
  public Payment Element; `STRIPE_PAYMENT_METHOD_CONFIGURATION_ID` is not used).
  When `PUBLIC_WWW_STAGING_SITE_ORIGIN` and `EVOLVESPROUTS_STRIPE_STAGING_SECRET_KEY`
  are set, requests whose `Origin` or `Referer` matches that staging site use
  the staging Stripe secret; otherwise the live `EVOLVESPROUTS_STRIPE_SECRET_KEY`
  is used (reservation submission uses the same selection for PaymentIntent retrieval).
  `POST /v1/reservations` (and `/www/v1/reservations`) accepts camelCase booking-modal
  fields, persists contact + program-enrollment lead, then sends booking confirmation
  (SES), optional Mailchimp subscribe, and a plain-text **sales recap** with extended
  booking context when provided, and signed upload/download URL generation in
  `backend/src/app/api/admin.py`.

### Health check
- Function: HealthCheckFunction
- Handler: backend/lambda/health/handler.py
- Trigger: API Gateway `GET /health`
- Auth: IAM
- Purpose: service health and configuration checks
- DB access: RDS Proxy with IAM auth (`evolvesprouts_app`)

### SES template manager (custom resource)
- Function: SesTemplateManagerFunction
- Handler: backend/lambda/ses_template_manager/handler.py
- Trigger: CloudFormation custom resource `SesEmailTemplates`
- Stack: nested stack `evolvesprouts-Messaging` (`backend/infrastructure/lib/messaging-stack.ts`)
- Purpose: create/update/delete SES stored email templates used by public
  transactional flows (contact, media download link, booking confirmation).
  Pending FPS bookings may instead send booking confirmation via
  `SendRawEmail` (multipart HTML + inline PNG) when the client supplies a valid
  PNG data URL.
- VPC: **No**
- Permissions: SES `CreateTemplate`, `UpdateTemplate`, `DeleteTemplate`, `GetTemplate`

## Auth and security Lambdas

### Pre sign-up trigger
- Function: AuthPreSignUpFunction
- Handler: backend/lambda/auth/pre_signup/handler.py
- Trigger: Cognito User Pool PRE_SIGN_UP
- Purpose: validation and pre-sign-up hooks

### Define auth challenge
- Function: AuthDefineChallengeFunction
- Handler: backend/lambda/auth/define_auth_challenge/handler.py
- Trigger: Cognito User Pool DEFINE_AUTH_CHALLENGE
- Purpose: choose the next passwordless challenge step

### Create auth challenge
- Function: AuthCreateChallengeFunction
- Handler: backend/lambda/auth/create_auth_challenge/handler.py
- Trigger: Cognito User Pool CREATE_AUTH_CHALLENGE
- Purpose: generate OTP/magic link and send email
- Permissions: SES `SendEmail` / `SendRawEmail` on the verified From address identity
  and the derived domain identity ARN (`identity/<domain>` from `AuthEmailFromAddress`),
  so sending still works when SES authorizes by domain verification

### Verify auth challenge
- Function: AuthVerifyChallengeFunction
- Handler: backend/lambda/auth/verify_auth_challenge/handler.py
- Trigger: Cognito User Pool VERIFY_AUTH_CHALLENGE_RESPONSE
- Purpose: validate passwordless challenge response

### Post authentication
- Function: AuthPostAuthFunction
- Handler: backend/lambda/auth/post_authentication/handler.py
- Trigger: Cognito User Pool POST_AUTHENTICATION
- Purpose: update `custom:last_auth_time` after successful login

### Device attestation authorizer
- Function: DeviceAttestationAuthorizer
- Handler: backend/lambda/authorizers/device_attestation/handler.py
- Trigger: API Gateway request authorizer
- Purpose: verify device attestation JWTs for public asset endpoints

### Admin group authorizer
- Function: AdminGroupAuthorizerFunction
- Handler: backend/lambda/authorizers/cognito_group/handler.py
- Trigger: API Gateway request authorizer
- Purpose: verify JWT and check user belongs to the `admin` Cognito group
- VPC: **No** (runs outside VPC to fetch JWKS from Cognito)
- Environment: `ALLOWED_GROUPS=admin`

### User authorizer (any authenticated user)
- Function: UserAuthorizerFunction
- Handler: backend/lambda/authorizers/cognito_user/handler.py
- Trigger: API Gateway request authorizer
- Purpose: verify JWT for any authenticated Cognito user (no group requirement)
- VPC: **No** (runs outside VPC to fetch JWKS from Cognito)

## Deployment and maintenance Lambdas

### Migrations
- Function: EvolvesproutsMigrationFunction
- Handler: backend/lambda/migrations/handler.py
- Trigger: CloudFormation custom resource during deploy
- Purpose: run Alembic migrations and optional seed SQL
- DB access: direct cluster endpoint with password auth

### Admin bootstrap
- Function: AdminBootstrapFunction
- Handler: backend/lambda/admin_bootstrap/handler.py
- Trigger: CloudFormation custom resource (optional)
- Purpose: create a bootstrap admin user and add to admin group

### API key rotation
- Function: ApiKeyRotationFunction
- Handler: backend/lambda/api_key_rotation/handler.py
- Trigger: EventBridge scheduled rule (every 90 days)
- Purpose: rotate the API Gateway API key to limit exposure from compromise
- Reliability: retries transient API Gateway and Secrets Manager failures with
  exponential backoff + jitter
- VPC: Yes
- Permissions: API Gateway key management, Secrets Manager read/write
- Environment:
  - `API_GATEWAY_REST_API_ID`: REST API ID
  - `API_GATEWAY_USAGE_PLAN_ID`: usage plan ID
  - `API_KEY_SECRET_ARN`: Secrets Manager ARN for key storage
  - `API_KEY_NAME_PREFIX`: prefix for key names
  - `GRACE_PERIOD_HOURS`: hours to keep old key active (default 24)

### Media request processor
- Function: MediaRequestProcessor
- Handler: backend/lambda/media_processor/handler.py
- Stack: nested stack `evolvesprouts-Messaging`
- Trigger: SQS queue (`evolvesprouts-media-queue`)
- Purpose: process media lead captures and fan out actions (including Mailchimp
  free-resource journey re-trigger on repeat requests during the transition
  period, and optional welcome journey for opted-in contacts)
- Actions: contact upsert in DB, idempotent sales lead creation, SES templated
  download-link email to the submitter, Mailchimp sync (merge fields + tag +
  optional free-resource Customer Journey trigger; consent-gated when
  `MAILCHIMP_REQUIRE_MARKETING_CONSENT=true`), optional welcome journey for
  `marketing_opt_in`, and SES **sales recap** on **new** media leads only (via
  proxy `ListUsersInGroup` to `ADMIN_GROUP`; duplicate re-downloads skip recap; not `SUPPORT_EMAIL`)
- DB access: RDS Proxy with IAM auth (`evolvesprouts_admin`)
- VPC: Yes
- Permissions: SES `SendEmail`, `SendRawEmail`, and `SendTemplatedEmail` (verified
  internal sender + `AuthEmailFromAddress` identities and derived domain ARNs),
  Secrets Manager read for Mailchimp API key,
  Lambda invoke permission for `AwsApiProxyFunction`
- Environment:
  - `DATABASE_SECRET_ARN`, `DATABASE_NAME`, `DATABASE_USERNAME`,
    `DATABASE_PROXY_ENDPOINT`, `DATABASE_IAM_AUTH`
  - `SES_SENDER_EMAIL`, `CONFIRMATION_EMAIL_FROM_ADDRESS`, `COGNITO_USER_POOL_ID`,
    `ADMIN_GROUP`, `AWS_PROXY_FUNCTION_ARN`, `SALES_RECAP_DISPLAY_TIMEZONE`
    (IANA timezone for media-lead recap **Submitted at**; CDK `SalesRecapDisplayTimezone`)
  - `MAILCHIMP_API_SECRET_ARN`, `MAILCHIMP_LIST_ID`,
    `MAILCHIMP_SERVER_PREFIX`
  - `MEDIA_DEFAULT_RESOURCE_KEY`
  - `ASSET_SHARE_LINK_BASE_URL`, `ASSET_SHARE_LINK_DEFAULT_ALLOWED_DOMAINS`
    (same host allowlist as admin for auto-created share links),
    `MAILCHIMP_MEDIA_DOWNLOAD_MERGE_TAG` (optional Mailchimp merge field for stable
    `/v1/assets/email-download/{token}` download URL)
  - `MAILCHIMP_FREE_RESOURCE_JOURNEY_ID`, `MAILCHIMP_FREE_RESOURCE_JOURNEY_STEP_ID` (optional;
    Customer Journey API trigger after successful member sync; empty disables)
  - `MAILCHIMP_REQUIRE_MARKETING_CONSENT` (when `true`, gate legacy Mailchimp
    subscribe + free-resource journey on `marketing_opt_in`)
  - `MAILCHIMP_WELCOME_JOURNEY_ID`, `MAILCHIMP_WELCOME_JOURNEY_STEP_ID` (optional;
    shared welcome journey for opted-in contacts; empty disables)
  - `PUBLIC_WWW_BASE_URL` (logo and footer links in SES HTML shell)
  - optional `PUBLIC_WWW_INSTAGRAM_URL`, `PUBLIC_WWW_LINKEDIN_URL`,
    `PUBLIC_WWW_WHATSAPP_URL` (same semantics as public site env; empty falls back
    in application code; `wa.me/message/...` is coerced to `wa.me/<digits>` for email)
  - `PUBLIC_WWW_BUSINESS_PHONE_NUMBER` (used to build `wa.me/<digits>` links;
    align with `NEXT_PUBLIC_BUSINESS_PHONE_NUMBER`)

### Expense parser processor
- Function: ExpenseParserFunction
- Handler: backend/lambda/expense_parser/handler.py
- Stack: nested stack `evolvesprouts-Messaging`
- Trigger: SQS queue (`evolvesprouts-expense-parser-queue`)
- Purpose: process async invoice parse requests and enrich expense records
  using OpenRouter via `AwsApiProxyFunction`; when `vendor_id` is unset and the
  model returns `vendor_name`, attempts a unique match among **active** vendor
  organizations: case-insensitive exact trimmed name; else a single `ILIKE`
  substring hit when the vendor name contains the parsed string (only when the
  parsed string is long enough and not generic-only tokens); else, if the parsed
  string contains a specific vendor list name, the longest such match wins when
  unambiguous (covers legal invoice names vs shorter list labels). Weak matches
  never write `vendor_id`. Parsed vendor text is not stored on the expense row;
  only `vendor_id` is updated when a match is found.
  Parsed `subtotal` / `tax` / `total` accept common formatted strings (currency
  symbols, thousands separators, alternate keys such as `amount`), and infer
  `total` from line-item amounts when every line has an `amount` and top-level
  totals are missing.
  When `currency` is still unset, monetary strings that contain a bare `$` (not
  `HK$`, `S$`, etc.) and no other currency markers infer `USD`; the model may
  also return `$` as `currency`, which normalizes to `USD`.
- DB access: RDS Proxy with IAM auth (`evolvesprouts_admin`)
- VPC: Yes
- Permissions: S3 read for the assets bucket, Secrets Manager read for OpenRouter key,
  Lambda invoke permission for `AwsApiProxyFunction`
- Environment:
  - `DATABASE_SECRET_ARN`, `DATABASE_NAME`, `DATABASE_USERNAME`,
    `DATABASE_PROXY_ENDPOINT`, `DATABASE_IAM_AUTH`
  - `ASSETS_BUCKET_NAME`
  - `OPENROUTER_API_KEY_SECRET_ARN`, `OPENROUTER_CHAT_COMPLETIONS_URL`,
    `OPENROUTER_MODEL`, `OPENROUTER_MAX_FILE_BYTES`
  - `AWS_PROXY_FUNCTION_ARN`

### Inbound invoice email processor
- Function: InboundInvoiceEmailProcessor
- Handler: backend/lambda/inbound_invoice_email/handler.py
- Trigger: SQS queue (`evolvesprouts-inbound-invoice-email-queue`) fed by SES
  receipt-rule notifications through SNS
- Purpose: convert inbound invoice email attachments (or synthetic body text
  when there are no supported files) into `assets`, `expenses`, and
  `expense_attachments` rows, then enqueue the existing expense parser workflow
- DB access: RDS Proxy with IAM auth (`evolvesprouts_admin`)
- VPC: Yes
- Permissions: S3 read/write for the assets bucket (including the
  `inbound-email/raw/` prefix), SNS publish to the expense parser topic
- Environment:
  - `DATABASE_SECRET_ARN`, `DATABASE_NAME`, `DATABASE_USERNAME`,
    `DATABASE_PROXY_ENDPOINT`, `DATABASE_IAM_AUTH`
  - `ASSETS_BUCKET_NAME`
  - `EXPENSE_PARSE_TOPIC_ARN`
  - `INBOUND_INVOICE_ALLOWED_SENDER_PATTERNS` (optional comma-separated
    substrings; empty disables filtering; see `InboundInvoiceAllowedSenderPatterns`
    CDK parameter / GitHub var `CDK_PARAM_INBOUND_INVOICE_ALLOWED_SENDER_PATTERNS`)

### Eventbrite sync processor
- Function: EventbriteSyncProcessor
- Handler: backend/lambda/eventbrite_sync_processor/handler.py
- Trigger: SQS queue (`evolvesprouts-eventbrite-sync-queue`)
- Purpose: process async Eventbrite synchronization requests for event service instances
  and upsert Eventbrite event/ticket metadata while keeping DB as source of truth
- DB access: RDS Proxy with IAM auth (`evolvesprouts_admin`)
- VPC: Yes
- Permissions: Secrets Manager read for Eventbrite token, Lambda invoke permission
  for `AwsApiProxyFunction`
- Environment:
  - `DATABASE_SECRET_ARN`, `DATABASE_NAME`, `DATABASE_USERNAME`,
    `DATABASE_PROXY_ENDPOINT`, `DATABASE_IAM_AUTH`
  - `AWS_PROXY_FUNCTION_ARN`
  - `EVENTBRITE_API_BASE_URL`
  - `EVENTBRITE_ORGANIZATION_ID`
  - `EVENTBRITE_TOKEN_SECRET_ARN`

### AWS / HTTP proxy
- Function: AwsApiProxyFunction
- Handler: backend/lambda/aws_proxy/handler.py
- Trigger: Lambda-to-Lambda invocation (from in-VPC Lambdas)
- Purpose: generic proxy for AWS API calls and outbound HTTP requests
  that cannot be made from inside the VPC
- VPC: **No** (runs outside VPC for internet access)
- Allow-lists:
  - `ALLOWED_ACTIONS`: comma-separated `service:action` pairs for AWS
    API calls (e.g. `cognito-idp:list_users`, `cognito-idp:list_users_in_group`)
  - `ALLOWED_HTTP_URLS`: comma-separated URL prefixes for outbound HTTP
    requests (e.g. `https://api.example.com/v1/`)
- Security: only invocable by Lambdas granted `lambda:InvokeFunction`;
  IAM role scoped to specific AWS actions; all requests validated
  against the allow-lists before execution
- Why: Cognito disables PrivateLink when ManagedLogin is configured on
  the User Pool, so a VPC endpoint cannot be used.  This proxy provides
  a reusable channel for any service that is unreachable via PrivateLink.
- Client: in-VPC Lambdas import `app.services.aws_proxy.invoke` (for
  AWS calls) or `app.services.aws_proxy.http_invoke` (for HTTP calls)
