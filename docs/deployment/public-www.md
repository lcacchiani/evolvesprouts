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
- Behavior:
  - copy `releases/<release_id>/` from staging assets to production root
  - preserve existing `_next/static` hashed assets to avoid stale HTML
    requesting deleted chunks
  - invalidate production CloudFront (including `/_next/static/*` to clear
    stale asset error responses)

### Rollback

Rollback uses the same promotion workflow by promoting a previous `release_id`.

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
