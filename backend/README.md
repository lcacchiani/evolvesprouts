# Backend scaffold

This folder contains the backend scaffolding for the Montessori family
training platform. It includes shared Python modules, Lambda handlers,
and infrastructure templates.

## Region

Deploy the stacks in `ap-southeast-1` by default. The region is
configurable, but this repo assumes ap-southeast-1 for initial setup.

## Lambdas

- `auth_login` -> `POST /v1/auth/login`
- `admin_families` -> `GET /v1/admin/families`
- `public_events` -> `GET /v1/events`

## Pagination

- Use `?limit=` and `?cursor=` query parameters.
- Responses include `next_cursor` when more results are available.

## Environment variables

- `DB_PROXY_ENDPOINT`: RDS Proxy hostname.
- `DB_NAME`: Database name.
- `DB_USERNAME`: Database username (IAM auth).
- `DB_IAM_AUTH`: Set to `true` for IAM auth (default).
- `COGNITO_DOMAIN`: Cognito hosted UI domain.
- `COGNITO_CLIENT_ID`: Cognito app client id.
- `COGNITO_REDIRECT_URI`: Hosted UI redirect URI.
- `COGNITO_ADMIN_GROUP`: Admin group name (default: `admin`).
- `PUBLIC_API_KEY`: Optional API key for public endpoints.
- `EVENTS_LIMIT`: Default events page size (default: 100).
- `FAMILIES_LIMIT`: Default families page size (default: 200).

## Notes

- Admin routes assume API Gateway JWT authorizer is configured.
- Public events can optionally enforce an API key.
- `admin_families` and `public_events` run inside a VPC with
  `PrivateSubnetIds` and `LambdaSecurityGroupIds` from the template.
- This stack does not create NAT gateways. Use VPC endpoints only.
- Database connections use IAM auth via RDS Proxy.
- Update `backend/infrastructure/templates/backend-api.yaml` to match
  your deployment environment.

## Infrastructure templates

- `network.yaml`: VPC, subnets, and VPC endpoints (no NAT). Includes
  Lambda, Secrets Manager, and STS endpoints.
- `database.yaml`: Aurora PostgreSQL 16 Serverless v2 + RDS Proxy.
- `auth.yaml`: Cognito User Pool, client, hosted UI, admin group.
- `artifacts.yaml`: S3 bucket for Lambda deployment packages.
- `backend-api.yaml`: API Gateway + Lambda functions.

## Deployment order (suggested)

1. `network.yaml`
2. `auth.yaml`
3. `database.yaml`
4. `artifacts.yaml`
5. `backend-api.yaml`

## Outputs to wire between stacks

- `network.yaml` outputs:
  - `VpcId`
  - `PrivateSubnetIds`
  - `LambdaSecurityGroupId`
  - `DbSecurityGroupId`
- `database.yaml` outputs:
  - `DbProxyEndpoint`
  - `DbSecretArn`
  - `DbClusterResourceId`
  - `DbUsername`
  - `DatabaseName`
- `auth.yaml` outputs:
  - `UserPoolId`
  - `UserPoolClientId`
  - `CognitoDomain`
- `artifacts.yaml` outputs:
  - `ArtifactsBucketName`

## Additional AWS resources to consider

- S3 bucket for Lambda artifacts (the API stack expects one).
- Additional VPC endpoints if Lambdas need other AWS services.
- Custom domain + ACM certificate for API Gateway if required.
