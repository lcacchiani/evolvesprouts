# Public WWW deployment

`public_www` is a static website hosted in S3 and served by CloudFront.

## Environment model

Public WWW uses a single CloudFormation stack:

- **Public Website stack**: `evolvesprouts-public-www`

Inside the stack, production and staging use separate S3 + CloudFront assets:

- Production URL: `https://www.evolvesprouts.com`
- Staging URL: `https://www-staging.evolvesprouts.com`

The release process is **staging first**:

1. Push to `main` deploys to staging.
2. CI stores the exact built artifact at
   `s3://<staging-bucket>/releases/<release_id>/`.
3. Manual promotion copies that immutable artifact to production.

This guarantees production receives the exact artifact that was verified on
staging.

## Prerequisites

- ACM certificate in `us-east-1` covering:
  - `www.evolvesprouts.com`
  - `www-staging.evolvesprouts.com`
- CloudFront aliases configured for both domains

## CDK parameters

Provide these parameters in `backend/infrastructure/params/production.json`:

- `PublicWwwDomainName`: `www.evolvesprouts.com`
- `PublicWwwCertificateArn`: ACM certificate ARN for production
- `PublicWwwStagingDomainName`: `www-staging.evolvesprouts.com`
- `PublicWwwStagingCertificateArn`: ACM certificate ARN for staging
- `WafWebAclArn`: optional CloudFront WAF ACL ARN (us-east-1)

Public WWW CRM API configuration is provided at build time via:

- GitHub variable `NEXT_PUBLIC_WWW_CRM_API_BASE_URL`
- GitHub secret `NEXT_PUBLIC_WWW_CRM_API_KEY`

`evolvesprouts-public-www` CloudFront now proxies `https://{www-domain}/www/*`
to `https://api.evolvesprouts.com/www/*` with caching disabled for those
requests. Set `NEXT_PUBLIC_WWW_CRM_API_BASE_URL` to `/www` to keep browser API
calls same-origin and avoid cross-origin CORS preflight failures.

## CI/CD workflows

### Deploy to staging (automatic)

Workflow: `.github/workflows/deploy-public-www.yml`

- Trigger: push to `main` for `apps/public_www/**` or `scripts/**`
- Target stack: `evolvesprouts-public-www`
- Target environment: `staging`
- Release ID: `github.sha`
- Behavior:
  - deploy current artifact to staging root
  - store immutable snapshot in `releases/<release_id>/`
  - preserve existing `_next/static` hashed assets to avoid stale HTML
    requesting deleted chunks
  - invalidate staging CloudFront (including `/_next/static/*` to clear
    stale asset error responses)

### Promote to production (manual)

Workflow: `.github/workflows/promote-public-www.yml`

- Trigger: manual (`workflow_dispatch`)
- Inputs:
  - `promotion_mode=latest_staging` to promote the most recent staging build
  - `promotion_mode=release_id` with `release_id=<id>` to promote a specific
    staging release
  - `promotion_mode=maintenance_on` to deploy a static maintenance page to
    production and block `https://www.evolvesprouts.com/www/*` at CloudFront
- Behavior:
  - `latest_staging` / `release_id`:
    - copy `releases/<release_id>/` from staging assets to production root
    - preserve existing `_next/static` hashed assets to avoid stale HTML
      requesting deleted chunks
    - restore `/www/*` CloudFront proxy allowlist behavior
    - fully invalidate production CloudFront
  - `maintenance_on`:
    - deploy static maintenance artifact from `apps/public_www/maintenance/`
      to production root (no Next.js build required)
    - include `/images/evolvesprouts-logo.svg` from `apps/public_www/public/`
    - include `/favicon.ico` from `apps/public_www/public/`
    - set `Cache-Control: no-store` on maintenance files
    - switch `/www/*` CloudFront behavior to a maintenance block function
      returning `503 Service Unavailable`
    - fully invalidate production CloudFront

### Rollback

Rollback uses the same promotion workflow by promoting a previous `release_id`.

## Maintenance mode

Use maintenance mode when production must show a minimal static fallback page.

Maintenance artifact source:

- `apps/public_www/maintenance/index.html`
- `apps/public_www/maintenance/404.html`
- `apps/public_www/maintenance/styles.css`
- `apps/public_www/maintenance/robots.txt`
- `apps/public_www/maintenance/images/*.png`
- `apps/public_www/public/favicon.ico` (copied into maintenance output at deploy time)

Characteristics:

- Static HTML + CSS only (no JavaScript)
- Logo + maintenance text + contact methods (email, WhatsApp, Instagram)
- Maintenance contact values are injected from GitHub environment variables:
  - `NEXT_PUBLIC_EMAIL`
  - `NEXT_PUBLIC_WHATSAPP_URL`
  - `NEXT_PUBLIC_INSTAGRAM_URL`
- `/www/*` API proxy blocked at CloudFront while maintenance is enabled

### Enable maintenance mode (production)

Manual workflow:

- Run `.github/workflows/promote-public-www.yml`
- Select `promotion_mode=maintenance_on`

Local equivalent:

```bash
PUBLIC_WWW_STACK_NAME=evolvesprouts-public-www \
PUBLIC_WWW_ENVIRONMENT=production \
PUBLIC_WWW_MAINTENANCE_MODE=true \
NEXT_PUBLIC_EMAIL=hello@example.com \
NEXT_PUBLIC_WHATSAPP_URL=https://wa.me/message/EXAMPLE \
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/example \
bash scripts/deploy/deploy-public-www.sh
```

### Disable maintenance mode (production)

Recommended:

- Run `.github/workflows/promote-public-www.yml`
- Select `promotion_mode=latest_staging`

Alternative:

- Run `.github/workflows/promote-public-www.yml`
- Select `promotion_mode=release_id`
- Provide a known-good staged release ID

Disabling maintenance mode restores the standard `/www/*` CloudFront allowlist
function and promotes the selected staged release to production.

## Local build and deploy

```bash
cd apps/public_www
npm ci
npm run build
```

From repo root, deploy to production assets in the Public Website stack:

```bash
bash scripts/deploy/deploy-public-www.sh
```

Deploy to staging assets and persist an immutable release snapshot:

```bash
PUBLIC_WWW_STACK_NAME=evolvesprouts-public-www \
PUBLIC_WWW_ENVIRONMENT=staging \
PUBLIC_WWW_RELEASE_ID=$(git rev-parse HEAD) \
bash scripts/deploy/deploy-public-www.sh
```

Promote a release from staging to production:

```bash
PUBLIC_WWW_STACK_NAME=evolvesprouts-public-www \
PUBLIC_WWW_PROMOTE_RELEASE_ID=<release_id> \
bash scripts/deploy/deploy-public-www.sh
```

Promote the latest staged release (runner equivalent of
`promotion_mode=latest_staging`):

```bash
STAGING_BUCKET="$(aws cloudformation describe-stacks \
  --stack-name evolvesprouts-public-www \
  --query "Stacks[0].Outputs[?OutputKey=='PublicWwwStagingBucketName'].OutputValue" \
  --output text)"
LATEST_RELEASE_ID="$(aws s3 cp \
  "s3://$STAGING_BUCKET/releases/latest-release-id.txt" - | tr -d '\r\n')"
PUBLIC_WWW_STACK_NAME=evolvesprouts-public-www \
PUBLIC_WWW_PROMOTE_RELEASE_ID="$LATEST_RELEASE_ID" \
bash scripts/deploy/deploy-public-www.sh
```

## Figma token sync in CI/CD

`public_www` uses the Token Studio pipeline for design tokens:

- `figma/token-studio/` stores Token Studio design tokens (tracked in git)
- `figma/files/` stores raw Figma API payloads (gitignored)

The staging deploy workflow runs `npm run figma:pull` and
`npm run figma:tokenize` before `npm run build`.
`npm run build` runs `figma:build:studio` to generate CSS custom
properties from Token Studio tokens, then `next build` to produce
the static site.

If `FIGMA_FILE_KEY` or OAuth credentials are unavailable, pull is
skipped and build uses the committed Token Studio tokens.

For the full Figma pipeline architecture, see
[docs/architecture/public-www-figma-pipeline.md](../architecture/public-www-figma-pipeline.md).

The deploy workflow reads these GitHub values for OAuth 2.0 auth:

- Secrets:
  - `FIGMA_OAUTH_CLIENT_ID`
  - `FIGMA_OAUTH_CLIENT_SECRET`
  - `FIGMA_OAUTH_REFRESH_TOKEN`
- Variables:
  - `PUBLIC_WWW_FIGMA_FILE_KEY`
  - `PUBLIC_WWW_FIGMA_TOKEN_ROOT_NODE` (scopes extraction to a frame)
  - `PUBLIC_WWW_FIGMA_OAUTH_TOKEN_URL` (optional override)

## SEO behavior

- Production remains indexable.
- Staging sends `X-Robots-Tag: noindex, nofollow, noarchive` from CloudFront.
- A visible `Staging` badge is rendered in the top-right corner for staging
  hostnames.

`public_www` intentionally does **not** use SPA fallback rewrites. CloudFront
returns normal 404 responses for unknown routes, which preserves crawler
semantics for indexing.

For branded not-found UX on static export, CloudFront custom error responses
map S3 403/404 origin misses to `/404.html` while preserving HTTP 404 status.
