# CRM web deployment

`crm_web` is a static shell SPA hosted in S3 and served by CloudFront.

## Prerequisites

- ACM certificate in `us-east-1` for `crm.evolvesprouts.com`
- CloudFront alias configured with the domain above

## CDK parameters

Provide these parameters when deploying `evolvesprouts-crm-web`:

- `CrmWebDomainName`: `crm.evolvesprouts.com`
- `CrmWebCertificateArn`: ACM certificate ARN (us-east-1)
- `WafWebAclArn`: optional CloudFront WAF ACL ARN (us-east-1). Set to an
  empty string to deploy without WAF.

## Build and deploy

```
cd apps/crm_web
npm ci
npm run build
```

From the repo root:

```bash
bash scripts/deploy/deploy-crm-web.sh
```

## CORS configuration

Set `CORS_ALLOWED_ORIGINS` (or CDK context `corsAllowedOrigins`) to include:

- `https://crm.evolvesprouts.com`
- `http://localhost:3000`

This is required if the CRM shell calls authenticated backend endpoints.
