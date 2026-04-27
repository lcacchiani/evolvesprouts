import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '../out/landing-pages-manifest.json');

const API_BASE_URL_ENV = 'NEXT_PUBLIC_API_BASE_URL';
const API_KEY_ENV = 'NEXT_PUBLIC_WWW_CRM_API_KEY';
const BUILD_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 2;

function buildCalendarUrl(baseUrl, slug) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const search = new URLSearchParams({ slug });
  return `${trimmed}/v1/calendar/public?${search.toString()}`;
}

async function fetchWithTimeout(url, apiKey, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldFailResponse(response) {
  if (response.ok) {
    return false;
  }
  if (response.status >= 500) {
    return true;
  }
  return false;
}

async function probeSlug(baseUrl, apiKey, slug) {
  const url = buildCalendarUrl(baseUrl, slug);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, apiKey, BUILD_TIMEOUT_MS);
      if (shouldFailResponse(response)) {
        const text = await response.text().catch(() => '');
        lastError = new Error(
          `HTTP ${response.status} for slug=${slug} attempt=${attempt}: ${text.slice(0, 200)}`,
        );
        continue;
      }
      return;
    } catch (error) {
      lastError = error;
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const reason = isAbort ? 'timeout' : 'transport';
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Calendar probe failed for slug=${slug} (${reason}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
}

function main() {
  const baseUrl = process.env[API_BASE_URL_ENV]?.trim() ?? '';
  const apiKey = process.env[API_KEY_ENV]?.trim() ?? '';
  if (!baseUrl || !apiKey) {
    console.error(
      `${API_BASE_URL_ENV} and ${API_KEY_ENV} must be set for landing page calendar validation.`,
    );
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to read ${manifestPath}. Run next build first.`, error);
    process.exit(1);
  }

  const slugs = Array.isArray(manifest.slugs) ? manifest.slugs : [];
  if (slugs.length === 0) {
    console.warn('No landing page slugs in manifest; skipping calendar probes.');
    return;
  }

  return Promise.all(slugs.map((slug) => probeSlug(baseUrl, apiKey, slug))).then(
    () => {
      console.log(`Calendar reachability OK for ${slugs.length} landing page slug(s).`);
    },
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}

await main();
