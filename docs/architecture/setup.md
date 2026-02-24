# Deployment setup

## Deployment prerequisites (AWS + GitHub OIDC)

The GitHub Actions workflows assume an IAM role named `GitHubActionsRole` in
your AWS account. To allow OIDC-based role assumption, complete these steps
once per account/region.

### 1) Create the GitHub OIDC provider

In AWS Console: **IAM → Identity providers → Add provider**

- Provider type: **OpenID Connect**
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

### 2) Update the IAM role trust policy

Apply the following trust policy to the `GitHubActionsRole` (replace
`<AWS_ACCOUNT_ID>` and `<ORG>/<REPO>`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<ORG>/<REPO>:*"
        }
      }
    }
  ]
}
```

### 3) Create the GitHubActionsRole (if missing)

If you do not see `GitHubActionsRole`, create it:

1. **IAM → Roles → Create role** (tag it with `Organization: LX Software`
   and `Project: Evolve Sprouts`)
2. **Trusted entity**: Web identity
3. **Provider**: `token.actions.githubusercontent.com`
4. **Audience**: `sts.amazonaws.com`
5. **Permissions**: `AdministratorAccess` (tighten later)
6. **Role name**: `GitHubActionsRole`

If the wizard asks for a GitHub organization, use the repo owner (org or user),
for example `your-org` or `your-user`.

For the OIDC provider itself, add the same tags:
`Organization: LX Software`, `Project: Evolve Sprouts`.

## GitHub Actions configuration

### Variables (non-secret)

- `AWS_ACCOUNT_ID`
- `AWS_REGION`
- `CDK_STACKS` (optional; `all stacks`, `backend`, `admin web`, or `public website`)
- `CDK_BOOTSTRAP_QUALIFIER` (optional)
- `CDK_PARAM_FILE` (e.g. `backend/infrastructure/params/production.json`)
  - For Public WWW deploys, include:
    - `PublicWwwDomainName`
    - `PublicWwwCertificateArn`
    - `PublicWwwStagingDomainName`
    - `PublicWwwStagingCertificateArn`
- `NEXT_PUBLIC_WWW_CRM_API_BASE_URL` (for Public WWW builds)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (for Public WWW booking form)
- `NEXT_PUBLIC_FPS_MERCHANT_NAME` (for Public WWW payment display)
- `NEXT_PUBLIC_FPS_MOBILE_NUMBER` (for Public WWW payment display)
- `NEXT_PUBLIC_GTM_ID` (optional GTM container ID)
- `NEXT_PUBLIC_EMAIL` (maintenance page contact)
- `NEXT_PUBLIC_WHATSAPP_URL` (maintenance page contact)
- `NEXT_PUBLIC_INSTAGRAM_URL` (maintenance page contact)
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
- `FIREBASE_IOS_BUNDLE_ID` (use `IOS_BUNDLE_ID` value)
- `FIREBASE_STORAGE_BUCKET` (optional)
- `FIREBASE_APP_CHECK_DEBUG` (optional, `true` for debug providers)
- `PUBLIC_WWW_FIGMA_FILE_KEY` (for Token Studio sync workflow)
- `PUBLIC_WWW_FIGMA_TOKEN_ROOT_NODE` (optional frame scope)
- `PUBLIC_WWW_FIGMA_OAUTH_TOKEN_URL` (optional OAuth token URL override)

### Secrets

- `CDK_PARAM_GOOGLE_CLIENT_SECRET`
- `CDK_PARAM_PUBLIC_API_KEY_VALUE`
- `CDK_PARAM_ADMIN_BOOTSTRAP_TEMP_PASSWORD` (optional)
- `NEXT_PUBLIC_WWW_CRM_API_KEY` (Public WWW browser API key)
- `AMPLIFY_API_KEY`
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT`
- `APPSTORE_API_KEY_JSON` (or `APPSTORE_ISSUER_ID`, `APPSTORE_API_KEY_ID`, `APPSTORE_API_PRIVATE_KEY`)
- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `MATCH_DEPLOY_KEY`
- `FASTLANE_USER`
- `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD`
- `FIGMA_OAUTH_CLIENT_ID`
- `FIGMA_OAUTH_CLIENT_SECRET`
- `FIGMA_OAUTH_REFRESH_TOKEN`

### Existing infrastructure reuse (auto-detected)

The backend deploy workflow detects existing infrastructure and sets
environment variables for CDK imports. These values are not required
GitHub variables. You can set them manually to force imports.

Optional env vars used by CDK:
- `EXISTING_VPC_ID`
- `EXISTING_DB_CLUSTER_IDENTIFIER`
- `EXISTING_DB_CLUSTER_ENDPOINT`
- `EXISTING_DB_CLUSTER_READER_ENDPOINT`
- `EXISTING_DB_CLUSTER_PORT`
- `EXISTING_DB_PROXY_NAME`
- `EXISTING_DB_PROXY_ARN`
- `EXISTING_DB_PROXY_ENDPOINT`
- `EXISTING_DB_CREDENTIALS_SECRET_NAME`
- `EXISTING_DB_CREDENTIALS_SECRET_ARN`
- `EXISTING_DB_CREDENTIALS_SECRET_KMS_KEY_ARN`
- `EXISTING_DB_APP_USER_SECRET_NAME`
- `EXISTING_DB_APP_USER_SECRET_ARN`
- `EXISTING_DB_APP_USER_SECRET_KMS_KEY_ARN`
- `EXISTING_DB_ADMIN_USER_SECRET_NAME`
- `EXISTING_DB_ADMIN_USER_SECRET_ARN`
- `EXISTING_DB_ADMIN_USER_SECRET_KMS_KEY_ARN`
- `EXISTING_DB_SECURITY_GROUP_ID`
- `EXISTING_PROXY_SECURITY_GROUP_ID`
- `EXISTING_LAMBDA_SECURITY_GROUP_ID`
- `EXISTING_MIGRATION_SECURITY_GROUP_ID`
- `MIGRATIONS_FORCE_RUN_ID`

If any existing DB secrets use a customer-managed KMS key, provide the
matching `*_SECRET_KMS_KEY_ARN` value so Lambda roles can decrypt the
secret. The deploy workflow attempts to auto-detect KMS key ARNs for
existing secrets when possible.

## How to obtain provider values

### Google (OAuth client)
1. Go to **Google Cloud Console → APIs & Services → Credentials**.
2. Create an **OAuth Client ID** (Web application).
3. Add the redirect URI:
   `https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`
4. Copy:
   - **Client ID** → `GoogleClientId`
   - **Client Secret** → `CDK_PARAM_GOOGLE_CLIENT_SECRET`

### Firebase (App Check + config)
1. Go to **Firebase Console → Project Settings → General**.
2. Copy:
   - **Project ID** → `FIREBASE_PROJECT_ID`
   - **Project Number** → used in `DeviceAttestationAudience`
   - **Web API Key** → `FIREBASE_API_KEY`
3. Under **Your Apps**, copy:
   - **Android App ID** → `FIREBASE_ANDROID_APP_ID`
   - **iOS App ID** → `FIREBASE_IOS_APP_ID`
   - **iOS Bundle ID** → `FIREBASE_IOS_BUNDLE_ID`
4. Configure App Check:
   - Android: **Play Integrity**
   - iOS: **App Attest**
5. Set backend attestation values:
   - `DeviceAttestationJwksUrl`: `https://firebaseappcheck.googleapis.com/v1/jwks`
   - `DeviceAttestationIssuer`: `https://firebaseappcheck.googleapis.com/`
   - `DeviceAttestationAudience`:
     `projects/<PROJECT_NUMBER>/apps/<APP_ID>` (use both iOS + Android IDs)
   - In CI, `DeviceAttestationAudience` is derived automatically from:
     `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_IOS_APP_ID`,
     `FIREBASE_ANDROID_APP_ID`.

### Android (signing + Play Console)
1. Generate a release keystore with OpenSSL (save the passwords and alias you choose):
   ```bash
   openssl genrsa -aes256 -out upload.key 2048
   openssl req -new -key upload.key -out upload.csr
   openssl x509 -req -days 10000 -in upload.csr -signkey upload.key -out upload.crt
   openssl pkcs12 -export -out keystore.p12 -inkey upload.key -in upload.crt -name evolvesprouts_release
   ```
2. Base64 encode the keystore for GitHub Secrets:
   ```bash
   # Linux
   base64 -w 0 keystore.p12 > keystore.base64
   # macOS
   base64 keystore.p12 > keystore.base64
   ```
3. Set GitHub Secrets:
   - `ANDROID_KEYSTORE_BASE64` = contents of `keystore.base64`
   - `ANDROID_KEYSTORE_PASSWORD` = PKCS12 export password (set when running `openssl pkcs12 -export`)
   - `ANDROID_KEY_PASSWORD` = private key password (set when running `openssl genrsa -aes256`)
   - `ANDROID_KEY_ALIAS` = alias (e.g., `evolvesprouts_release`)
4. Set GitHub Variables:
   - `ANDROID_RELEASE_TRACK` (`internal`, `alpha`, `beta`, or `production`)
   - Note: `.github/workflows/deploy-mobile.yml` currently uploads with
     hardcoded package name `com.evolvesprouts`
5. Create a Play Console service account:
   - Google Cloud Console -> IAM & Admin -> Service Accounts -> Create
   - Grant the service account access in Play Console:
     Play Console -> Setup -> API access -> Link project -> Grant permissions
   - Create and download the JSON key
   - Set GitHub Secret `GOOGLE_PLAY_SERVICE_ACCOUNT` to the JSON contents

### Amplify API key (mobile/public API key)
1. Use the same value as your backend `PublicApiKeyValue`
   (`CDK_PARAM_PUBLIC_API_KEY_VALUE` secret).
2. Set GitHub Secret `AMPLIFY_API_KEY` to that value so the mobile app
   can call API-key-protected public endpoints.

### iOS (signing + TestFlight)
1. Create an iOS App ID:
   - Apple Developer -> Certificates, Identifiers & Profiles -> Identifiers
   - Create an App ID for your bundle (e.g., `com.evolvesprouts`)
   - Use this value as `IOS_BUNDLE_ID` and `FIREBASE_IOS_BUNDLE_ID`
2. Find your Team ID:
   - Apple Developer -> Membership -> Team ID
   - Set GitHub Variable `APPLE_TEAM_ID`
3. (Optional) Use Fastlane Match for signing:
   - Create a private repo to store certificates/profiles
   - Set GitHub Secrets:
     - `MATCH_GIT_URL` = repo SSH/HTTPS URL
     - `MATCH_PASSWORD` = encryption password
     - `FASTLANE_USER` = Apple ID email
     - `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` = app-specific password
   - The workflow will run `fastlane match appstore --readonly` if present
4. (Optional) Use manual provisioning profile:
   - Create or download an App Store provisioning profile
   - Set GitHub Variable `IOS_PROVISIONING_PROFILE` to the profile name
   - If unset, the workflow defaults to automatic signing
   - If `IOS_BUNDLE_ID` is unset, workflow fallbacks use `com.evolvesprouts`
5. Create App Store Connect API key:
   - App Store Connect -> Users and Access -> Keys -> Create API key
   - Download the `.p8` and note:
     - Issuer ID
     - Key ID
   - Set **one of**:
    - `APPSTORE_API_KEY_JSON` secret with:
      `{"issuer_id":"...","key_id":"...","private_key":"-----BEGIN EXAMPLE KEY-----\n...\n-----END EXAMPLE KEY-----"}`
     - or individual secrets:
       `APPSTORE_ISSUER_ID`, `APPSTORE_API_KEY_ID`, `APPSTORE_API_PRIVATE_KEY`
6. Ensure TestFlight/App record exists:
   - App Store Connect -> My Apps -> Create or select your app
   - Bundle ID must match `IOS_BUNDLE_ID`
7. Firebase iOS config:
   - Firebase Console -> Project Settings -> iOS app
   - Copy `FIREBASE_IOS_APP_ID` and set `FIREBASE_IOS_BUNDLE_ID`

### Apple (Sign in with Apple)
Sign in with Apple is not currently configured in `backend/infrastructure/lib/api-stack.ts`.
If Apple IdP support is reintroduced in the stack, add provider setup and
associated `CDK_PARAM_*` documentation in this section.
