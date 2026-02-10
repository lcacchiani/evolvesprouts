# Figma token pipeline for `public_www`

This directory stores input and output files used by the public website
token pipeline.

## Directory structure

- `files/`
  - Raw Figma API payloads produced by:
    - `npm run figma:pull` (OAuth 2.0 authenticated)
  - Expected files:
    - `file.json`
    - `variables.local.json`
- `mdm/exports/`
  - Design-token exports produced by a Figma MDM flow.
  - Default input file:
    - `tokens.json`
- `mdm/artifacts/`
  - Normalized artifacts produced for the website build.
  - Output file:
    - `tokens.normalized.json`
  - Generated JSON files are ignored from git by default.

## Build outputs

`npm run figma:build` writes CSS custom properties used by the site to:

- `src/app/generated/figma-tokens.css`

`src/app/globals.css` imports this generated file so token updates from
Figma flow through the website build.

For `figma:pull`, set `FIGMA_FILE_KEY` and either:

- `FIGMA_OAUTH_ACCESS_TOKEN`, or
- `FIGMA_OAUTH_CLIENT_ID`, `FIGMA_OAUTH_CLIENT_SECRET`, and
  `FIGMA_OAUTH_REFRESH_TOKEN`.

## Generating a Figma OAuth refresh token

The refresh token is a long-lived credential that allows the pipeline to
mint short-lived access tokens automatically. Follow these steps to
generate one.

### Prerequisites

You need a **Figma OAuth 2.0 app**. If you do not have one yet:

1. Go to [Figma Developer Settings](https://www.figma.com/developers/apps).
2. Click **Create a new app**.
3. Fill in the app name (e.g. `EvolveSpouts Token Sync`).
4. Under **Callback URL**, add: `http://localhost:3845/callback`
   (or a different port — see step 3 below).
5. Save the app and note the **Client ID** and **Client secret**.

### Step 1 — Set environment variables

Export your Figma OAuth app credentials:

```bash
export FIGMA_OAUTH_CLIENT_ID="your-client-id"
export FIGMA_OAUTH_CLIENT_SECRET="your-client-secret"
```

### Step 2 — Run the auth script

From the `apps/public_www` directory:

```bash
npm run figma:auth
```

This starts a temporary local server on port 3845 and opens your browser
to the Figma authorization page. If the browser does not open
automatically, copy the URL printed in the terminal.

To use a different port, set `FIGMA_OAUTH_PORT`:

```bash
FIGMA_OAUTH_PORT=9999 npm run figma:auth
```

If you change the port, update the callback URL in your Figma app
settings to match (e.g. `http://localhost:9999/callback`).

### Step 3 — Authorize in Figma

In the browser, Figma will ask you to authorize the app. Click **Allow**
to grant `files:read` and `file_variables:read` access.

### Step 4 — Copy the refresh token

After authorization, the script exchanges the code for tokens and prints
the `FIGMA_OAUTH_REFRESH_TOKEN` in the terminal. Copy this value.

### Step 5 — Store the token

**For local development**, add it to your `.env` file:

```bash
FIGMA_OAUTH_CLIENT_ID=your-client-id
FIGMA_OAUTH_CLIENT_SECRET=your-client-secret
FIGMA_OAUTH_REFRESH_TOKEN=your-refresh-token
FIGMA_FILE_KEY=your-figma-file-key
```

**For CI/CD (GitHub Actions)**, add these as repository secrets:

- `FIGMA_OAUTH_CLIENT_ID`
- `FIGMA_OAUTH_CLIENT_SECRET`
- `FIGMA_OAUTH_REFRESH_TOKEN`

And set `PUBLIC_WWW_FIGMA_FILE_KEY` as a repository variable.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Port already in use | Set `FIGMA_OAUTH_PORT` to a different port and update the Figma app callback URL. |
| Browser does not open | Copy the URL from the terminal and open it manually. |
| `invalid_grant` error | The authorization code may have expired. Re-run `npm run figma:auth`. |
| Token exchange fails with 401 | Verify your client ID and secret are correct. |
| Refresh token stops working | Figma refresh tokens can be revoked if the app is modified. Re-run `npm run figma:auth` to generate a new one. |
