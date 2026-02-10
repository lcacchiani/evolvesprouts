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
mint short-lived access tokens automatically.

There are two ways to generate one:

- **Option A** — [GitHub Actions workflow](#option-a--github-actions-workflow)
  (recommended; secrets never leave GitHub).
- **Option B** — [Local script](#option-b--local-script)
  (fully automated; requires Node.js locally).

Both options require a **Figma OAuth 2.0 app** — see
[Prerequisites](#prerequisites) first.

### Prerequisites

You need a **Figma OAuth 2.0 app**. If you do not have one yet:

1. Go to [Figma Developer Settings](https://www.figma.com/developers/apps).
2. Click **Create a new app**.
3. Fill in the app name (e.g. `EvolveSpouts Token Sync`).
4. Under **Callback URL**, add: `http://localhost:3845/callback`
   (or a different port if you plan to customize it).
5. Save the app and note the **Client ID** and **Client secret**.
6. Add `FIGMA_OAUTH_CLIENT_ID` and `FIGMA_OAUTH_CLIENT_SECRET` as
   GitHub repository secrets under **Settings > Secrets and variables >
   Actions**.

---

### Option A — GitHub Actions workflow

This approach keeps your client secret and refresh token inside GitHub
and never exposes them locally. The only manual step is authorizing in
a browser.

**Phase 1 — Get the authorization URL**

1. Go to **Actions** > **Generate Figma OAuth Refresh Token**.
2. Click **Run workflow**.
3. Set **step** to `get_auth_url`.
4. Click **Run workflow**.
5. Open the completed run and check the **Summary** tab — it contains
   the Figma authorization URL.

**Phase 2 — Authorize and copy the code**

1. Open the authorization URL in your browser.
2. Click **Allow** on the Figma consent page.
3. Figma redirects to `http://localhost:3845/callback?code=XXXXX&state=...`.
   The page will **not load** (no local server is running) — that is
   expected.
4. Copy the `code` value from the browser address bar (the string
   between `?code=` and `&state=`).

**Phase 3 — Exchange the code**

1. Go to **Actions** > **Generate Figma OAuth Refresh Token** >
   **Run workflow**.
2. Set **step** to `exchange_code`.
3. Paste the code into **authorization_code**.
4. Click **Run workflow**.
5. The workflow exchanges the code for a refresh token and automatically
   stores it as the `FIGMA_OAUTH_REFRESH_TOKEN` repository secret.

Check the run **Summary** tab for confirmation.

> **Note:** The authorization code is short-lived (a few minutes). If
> the exchange fails with `invalid_grant`, re-run from Phase 1.

---

### Option B — Local script

This runs the full OAuth flow on your machine using a temporary local
HTTP server.

**Step 1 — Set environment variables**

```bash
export FIGMA_OAUTH_CLIENT_ID="your-client-id"
export FIGMA_OAUTH_CLIENT_SECRET="your-client-secret"
```

**Step 2 — Run the auth script**

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

**Step 3 — Authorize in Figma**

Click **Allow** to grant `files:read` and `file_variables:read` access.

**Step 4 — Copy the refresh token**

The script exchanges the code and prints the
`FIGMA_OAUTH_REFRESH_TOKEN` in the terminal. Copy this value.

**Step 5 — Store the token**

For local development, add it to your `.env` file:

```bash
FIGMA_OAUTH_CLIENT_ID=your-client-id
FIGMA_OAUTH_CLIENT_SECRET=your-client-secret
FIGMA_OAUTH_REFRESH_TOKEN=your-refresh-token
FIGMA_FILE_KEY=your-figma-file-key
```

For CI/CD, add these as repository secrets:

- `FIGMA_OAUTH_CLIENT_ID`
- `FIGMA_OAUTH_CLIENT_SECRET`
- `FIGMA_OAUTH_REFRESH_TOKEN`

And set `PUBLIC_WWW_FIGMA_FILE_KEY` as a repository variable.

---

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Port already in use | Set `FIGMA_OAUTH_PORT` (local) or `callback_port` (Actions) to a different port and update the Figma app callback URL. |
| Browser does not open | Copy the URL from the terminal (local) or workflow summary (Actions) and open it manually. |
| `invalid_grant` error | The authorization code expired. Re-run from the authorization step. |
| Token exchange fails with 401 | Verify your client ID and secret are correct. |
| Refresh token stops working | Figma refresh tokens can be revoked if the app is modified. Re-generate one using either option above. |
| `gh secret set` fails (Actions) | `GITHUB_TOKEN` may lack permission to write secrets. Copy the token from the masked log output and add the secret manually. |
