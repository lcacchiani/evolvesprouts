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

## API Gateway Lambdas

### Admin API
- Function: EvolvesproutsAdminFunction
- Handler: backend/lambda/admin/handler.py
- Trigger: API Gateway — currently wired for
  `/v1/admin/assets/*`, `/v1/user/assets/*`, `/v1/assets/public/*`,
  and `/v1/assets/share/*`
- Auth: Cognito JWT — admin group for `/v1/admin/*`,
  any authenticated user for `/v1/user/*`,
  device attestation + API key for `/v1/assets/public/*`
- Purpose: asset metadata CRUD, grant management, stable share-link lifecycle
  (create/rotate/revoke), and signed upload/download URL generation in
  `backend/src/app/api/admin.py`.

### Health check
- Function: HealthCheckFunction
- Handler: backend/lambda/health/handler.py
- Trigger: API Gateway `GET /health`
- Auth: IAM
- Purpose: service health and configuration checks
- DB access: RDS Proxy with IAM auth (`evolvesprouts_app`)

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
- VPC: Yes
- Permissions: API Gateway key management, Secrets Manager read/write
- Environment:
  - `API_GATEWAY_REST_API_ID`: REST API ID
  - `API_GATEWAY_USAGE_PLAN_ID`: usage plan ID
  - `API_KEY_SECRET_ARN`: Secrets Manager ARN for key storage
  - `API_KEY_NAME_PREFIX`: prefix for key names
  - `GRACE_PERIOD_HOURS`: hours to keep old key active (default 24)

### Booking request processor
- Function: BookingRequestProcessor
- Handler: backend/lambda/manager_request_processor/handler.py
- Trigger: SQS queue (subscribed to SNS booking request topic)
- Purpose: process async booking submissions from the SNS topic
- DB access: RDS Proxy with IAM auth (`evolvesprouts_admin`)
- VPC: Yes
- Permissions: SES send email
- Environment:
  - `DATABASE_SECRET_ARN`, `DATABASE_NAME`, `DATABASE_USERNAME`,
    `DATABASE_PROXY_ENDPOINT`, `DATABASE_IAM_AUTH`
  - `SES_SENDER_EMAIL`, `SUPPORT_EMAIL`

### AWS / HTTP proxy
- Function: AwsApiProxyFunction
- Handler: backend/lambda/aws_proxy/handler.py
- Trigger: Lambda-to-Lambda invocation (from in-VPC Lambdas)
- Purpose: generic proxy for AWS API calls and outbound HTTP requests
  that cannot be made from inside the VPC
- VPC: **No** (runs outside VPC for internet access)
- Allow-lists:
  - `ALLOWED_ACTIONS`: comma-separated `service:action` pairs for AWS
    API calls (e.g. `cognito-idp:list_users`)
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
