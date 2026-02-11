#!/usr/bin/env node
/**
 * Figma MCP server launcher with OAuth2 authentication.
 *
 * Exchanges a Figma OAuth2 refresh token for a short-lived access
 * token and then spawns the Framelink Figma MCP server with that
 * token set as FIGMA_API_KEY.
 *
 * Required environment variables:
 *   FIGMA_OAUTH_CLIENT_ID
 *   FIGMA_OAUTH_CLIENT_SECRET
 *   FIGMA_OAUTH_REFRESH_TOKEN
 *
 * Optional:
 *   FIGMA_OAUTH_TOKEN_URL  (default: https://api.figma.com/v1/oauth/token)
 *
 * All stdio is forwarded between the parent process and the MCP
 * server so Cursor's MCP client can communicate transparently.
 */

import { spawn } from 'node:child_process';

const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';

function getEnv(name) {
  return process.env[name]?.trim() ?? '';
}

function getRequiredEnv(name) {
  const value = getEnv(name);
  if (!value) {
    process.stderr.write(
      `Error: environment variable ${name} is required for OAuth2 MCP launch.\n`,
    );
    process.exit(1);
  }
  return value;
}

async function fetchOAuthAccessToken({
  tokenUrl,
  clientId,
  clientSecret,
  refreshToken,
}) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `OAuth token refresh failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `OAuth token response is not valid JSON: ${text.slice(0, 500)}`,
    );
  }

  const accessToken = json.access_token?.trim?.() ?? '';
  if (!accessToken) {
    throw new Error(
      `OAuth token response is missing access_token: ${text.slice(0, 500)}`,
    );
  }

  return accessToken;
}

async function main() {
  const clientId = getRequiredEnv('FIGMA_OAUTH_CLIENT_ID');
  const clientSecret = getRequiredEnv('FIGMA_OAUTH_CLIENT_SECRET');
  const refreshToken = getRequiredEnv('FIGMA_OAUTH_REFRESH_TOKEN');
  const tokenUrl = getEnv('FIGMA_OAUTH_TOKEN_URL') || FIGMA_TOKEN_URL;

  process.stderr.write('Exchanging Figma OAuth2 refresh token...\n');

  const accessToken = await fetchOAuthAccessToken({
    tokenUrl,
    clientId,
    clientSecret,
    refreshToken,
  });

  process.stderr.write('OAuth2 access token obtained. Starting MCP server...\n');

  const child = spawn('npx', ['-y', 'figma-developer-mcp', '--stdio'], {
    env: {
      ...process.env,
      FIGMA_API_KEY: accessToken,
    },
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  // Forward stdin from Cursor → MCP server
  process.stdin.pipe(child.stdin);

  // Forward stdout from MCP server → Cursor
  child.stdout.pipe(process.stdout);

  child.on('error', (err) => {
    process.stderr.write(`MCP server spawn error: ${err.message}\n`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  // If our own stdin closes, signal the child
  process.stdin.on('end', () => {
    child.stdin.end();
  });
}

main().catch((error) => {
  process.stderr.write(`Fatal: ${error.message}\n`);
  process.exit(1);
});
