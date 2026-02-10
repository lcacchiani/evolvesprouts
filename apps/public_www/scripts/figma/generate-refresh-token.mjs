/**
 * Figma OAuth 2.0 refresh-token generator.
 *
 * Runs the full authorization-code flow locally:
 *   1. Starts a temporary HTTP server on localhost.
 *   2. Opens the Figma authorization page in the default browser.
 *   3. Handles the OAuth callback with the authorization code.
 *   4. Exchanges the code for an access token and refresh token.
 *   5. Prints the refresh token for use in .env or GitHub Secrets.
 *
 * Required environment variables:
 *   FIGMA_OAUTH_CLIENT_ID      – OAuth app client ID from Figma
 *   FIGMA_OAUTH_CLIENT_SECRET   – OAuth app client secret from Figma
 *
 * Optional:
 *   FIGMA_OAUTH_PORT            – Local server port (default: 3845)
 *
 * Usage:
 *   FIGMA_OAUTH_CLIENT_ID=xxx FIGMA_OAUTH_CLIENT_SECRET=yyy \
 *     node scripts/figma/generate-refresh-token.mjs
 *
 * Or via npm:
 *   FIGMA_OAUTH_CLIENT_ID=xxx FIGMA_OAUTH_CLIENT_SECRET=yyy \
 *     npm run figma:auth
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { URL, URLSearchParams } from 'node:url';

const FIGMA_AUTHORIZATION_URL = 'https://www.figma.com/oauth';
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
const SCOPES = 'file_content:read,file_variables:read';

function getRequiredEnv(name) {
  const value = process.env[name]?.trim() ?? '';
  if (!value) {
    console.error(`Error: environment variable ${name} is required.`);
    console.error('');
    console.error('Usage:');
    console.error(
      '  FIGMA_OAUTH_CLIENT_ID=xxx FIGMA_OAUTH_CLIENT_SECRET=yyy \\',
    );
    console.error('    npm run figma:auth');
    process.exit(1);
  }
  return value;
}

function buildAuthorizationUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    response_type: 'code',
  });
  return `${FIGMA_AUTHORIZATION_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens({
  code,
  clientId,
  clientSecret,
  redirectUri,
}) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  });

  const response = await fetch(FIGMA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Token exchange failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Token response is not valid JSON: ${text.slice(0, 500)}`);
  }

  return json;
}

function successHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Figma OAuth</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex;
         justify-content: center; align-items: center; height: 100vh;
         margin: 0; background: #f5f5f5; }
  .card { background: #fff; padding: 2rem 3rem; border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
  h1 { color: #333; font-size: 1.4rem; margin-bottom: 0.5rem; }
  p  { color: #666; }
</style>
</head>
<body>
  <div class="card">
    <h1>Figma OAuth complete</h1>
    <p>Your refresh token has been printed in the terminal.<br>
       You can close this tab.</p>
  </div>
</body>
</html>`;
}

function errorHtml(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Figma OAuth Error</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex;
         justify-content: center; align-items: center; height: 100vh;
         margin: 0; background: #fff5f5; }
  .card { background: #fff; padding: 2rem 3rem; border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
  h1 { color: #c00; font-size: 1.4rem; margin-bottom: 0.5rem; }
  p  { color: #666; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="card">
    <h1>OAuth Error</h1>
    <p><code>${message}</code></p>
    <p>Check the terminal for details.</p>
  </div>
</body>
</html>`;
}

async function openBrowser(url) {
  const { exec } = await import('node:child_process');
  const { platform } = await import('node:os');

  const commands = {
    darwin: 'open',
    win32: 'start',
    linux: 'xdg-open',
  };
  const cmd = commands[platform()] ?? 'xdg-open';

  return new Promise((resolve) => {
    exec(`${cmd} "${url}"`, (error) => {
      if (error) {
        // Browser open failed; user will need to open URL manually.
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function main() {
  const clientId = getRequiredEnv('FIGMA_OAUTH_CLIENT_ID');
  const clientSecret = getRequiredEnv('FIGMA_OAUTH_CLIENT_SECRET');
  const port = parseInt(process.env.FIGMA_OAUTH_PORT ?? '3845', 10);
  const redirectUri = `http://localhost:${port}/callback`;
  const state = randomBytes(16).toString('hex');

  console.log('');
  console.log('=== Figma OAuth 2.0 Refresh Token Generator ===');
  console.log('');
  console.log(`Redirect URI: ${redirectUri}`);
  console.log('');
  console.log(
    'IMPORTANT: Your Figma OAuth app must have this callback URL',
  );
  console.log(`configured: ${redirectUri}`);
  console.log('');

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);

    if (requestUrl.pathname !== '/callback') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const code = requestUrl.searchParams.get('code');
    const returnedState = requestUrl.searchParams.get('state');
    const error = requestUrl.searchParams.get('error');

    if (error) {
      const description =
        requestUrl.searchParams.get('error_description') ?? error;
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(errorHtml(description));
      console.error(`OAuth error from Figma: ${description}`);
      shutdown(1);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(errorHtml('No authorization code received.'));
      console.error('Error: no authorization code in callback.');
      shutdown(1);
      return;
    }

    if (returnedState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(errorHtml('State mismatch — possible CSRF.'));
      console.error('Error: OAuth state mismatch.');
      shutdown(1);
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens({
        code,
        clientId,
        clientSecret,
        redirectUri,
      });

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(successHtml());

      console.log('');
      console.log('=== OAuth Token Exchange Successful ===');
      console.log('');
      console.log(
        'FIGMA_OAUTH_REFRESH_TOKEN (copy this value):',
      );
      console.log('');
      console.log(`  ${tokens.refresh_token}`);
      console.log('');
      if (tokens.access_token) {
        console.log(
          `Access token (expires in ${tokens.expires_in ?? '?'}s):`,
        );
        console.log(`  ${tokens.access_token}`);
        console.log('');
      }
      if (tokens.user_id) {
        console.log(`Figma user ID: ${tokens.user_id}`);
        console.log('');
      }
      console.log('Next steps:');
      console.log(
        '  1. Add FIGMA_OAUTH_REFRESH_TOKEN to your .env file, or',
      );
      console.log(
        '  2. Add it as a GitHub Actions secret for CI/CD.',
      );
      console.log('');

      shutdown(0);
    } catch (exchangeError) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(errorHtml('Token exchange failed. Check terminal.'));
      console.error('Token exchange error:', exchangeError.message);
      shutdown(1);
    }
  });

  let shutdownCalled = false;
  function shutdown(exitCode) {
    if (shutdownCalled) {
      return;
    }
    shutdownCalled = true;
    server.close(() => {
      process.exit(exitCode);
    });
    // Force close after 2 seconds if connections linger.
    setTimeout(() => process.exit(exitCode), 2000).unref();
  }

  server.listen(port, async () => {
    const authUrl = buildAuthorizationUrl({ clientId, redirectUri, state });

    console.log('Waiting for Figma authorization...');
    console.log('');

    const opened = await openBrowser(authUrl);
    if (!opened) {
      console.log('Could not open browser automatically.');
      console.log('Open this URL in your browser to authorize:');
      console.log('');
      console.log(`  ${authUrl}`);
      console.log('');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Error: port ${port} is already in use.`,
      );
      console.error(
        `Set FIGMA_OAUTH_PORT to a different port and update your Figma app callback URL.`,
      );
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });
}

main();
