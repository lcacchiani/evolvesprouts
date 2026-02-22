# CDK parameter files

Use `production.json` as a template for CDK parameters.

## Public website parameters

`production.json` now includes both production and staging parameters for the
public website stacks:

- `PublicWwwDomainName` (comma-separated CloudFront aliases, for example
  `www.evolvesprouts.com,evolvesprouts.com`)
- `PublicWwwCertificateArn`
- `PublicWwwStagingDomainName` (comma-separated CloudFront aliases, for example
  `www-staging.evolvesprouts.com`)
- `PublicWwwStagingCertificateArn`
- `WafWebAclArn`

## Local deploy

```bash
cd backend/infrastructure
export CDK_PARAM_FILE=params/production.json
npx cdk deploy --require-approval never
```

## GitHub Actions

Set the repository variable `CDK_PARAM_FILE` to the path you want CI to use
(`params/production.json` by default).

> Keep secrets out of the repo. For production, use a private parameter file
> stored outside of git or generated in CI from secrets.
