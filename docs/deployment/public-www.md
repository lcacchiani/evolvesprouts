# Public WWW deployment

`public_www` is the public static website hosted in S3 and served by
CloudFront.

## Prerequisites

- ACM certificate in `us-east-1` for `www.evolvesprouts.com`
- CloudFront alias configured with the domain above

## CDK parameters

Provide these parameters when deploying `evolvesprouts-public-www`:

- `PublicWwwDomainName`: `www.evolvesprouts.com`
- `PublicWwwCertificateArn`: ACM certificate ARN (us-east-1)
- `WafWebAclArn`: existing CloudFront WAF ACL ARN (us-east-1)

## Build and deploy

```bash
cd apps/public_www
npm ci
npm run figma:build
npm run build
```

From the repo root:

```bash
bash scripts/deploy/deploy-public-www.sh
```

## Figma token sync in CI/CD

`public_www` includes Figma token scaffolding:

- `figma/files/` stores raw Figma API payloads
- `figma/mdm/exports/` stores token files produced by Figma MDM
- `figma/mdm/artifacts/` stores normalized artifacts

The deploy workflow runs `npm run figma:pull` before `npm run build`.
`npm run build` then runs `figma:build` to generate CSS tokens.
If `FIGMA_ACCESS_TOKEN` or `FIGMA_FILE_KEY` is unavailable, pull is skipped
and build falls back to local artifacts safely.

## SEO behavior

`public_www` intentionally does **not** use SPA fallback rewrites. CloudFront
returns normal 404 responses for unknown routes, which preserves crawler
semantics for indexing.
