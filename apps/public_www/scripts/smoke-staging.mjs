const SMOKE_BASE_URL_ENV = 'SMOKE_BASE_URL';
const SMOKE_API_KEY_ENV = 'SMOKE_API_KEY';
const SMOKE_CRM_API_BASE_URL_ENV = 'SMOKE_CRM_API_BASE_URL';
const SMOKE_MEDIA_API_BASE_URL_ENV = 'SMOKE_MEDIA_API_BASE_URL';
const FALLBACK_API_KEY_ENV = 'NEXT_PUBLIC_WWW_CRM_API_KEY';
const FALLBACK_CRM_API_BASE_URL_ENV = 'NEXT_PUBLIC_WWW_CRM_API_BASE_URL';
const FALLBACK_MEDIA_API_BASE_URL_ENV = 'NEXT_PUBLIC_ADMIN_API_BASE_URL';
const SMOKE_TIMEOUT_MS_ENV = 'SMOKE_TIMEOUT_MS';
const SMOKE_TURNSTILE_TOKEN_ENV = 'SMOKE_TURNSTILE_TOKEN';
const SMOKE_MAX_PAGES_ENV = 'SMOKE_MAX_PAGES';

const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT = 'evolvesprouts-public-www-smoke-runner/1.0';

const FALLBACK_LOCALES = ['en', 'zh-CN', 'zh-HK'];
const FALLBACK_ROUTE_PATHS = [
  '/',
  '/about-us',
  '/contact-us',
  '/events',
  '/privacy',
  '/terms',
  '/services/my-best-auntie-training-course',
];

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printUsage() {
  console.log(`
Usage:
  npm run smoke:staging
  npm run smoke:staging -- --pages-only
  npm run smoke:staging -- --api-only

Required:
  ${SMOKE_BASE_URL_ENV}            Absolute site origin to smoke test (for example https://www-staging.example.com)

API checks (required unless --pages-only):
  ${SMOKE_API_KEY_ENV}             Public CRM API key used for /www/v1 requests
                                   Falls back to ${FALLBACK_API_KEY_ENV} if unset.

Optional:
  ${SMOKE_TIMEOUT_MS_ENV}          Per-request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  ${SMOKE_TURNSTILE_TOKEN_ENV}     Optional Turnstile token for protected endpoints
  ${SMOKE_MAX_PAGES_ENV}           Optional max number of discovered pages to check
  ${SMOKE_CRM_API_BASE_URL_ENV}    Optional CRM API base URL fallback for /v1 endpoints
                                   Falls back to ${FALLBACK_CRM_API_BASE_URL_ENV} if unset.
  ${SMOKE_MEDIA_API_BASE_URL_ENV}  Optional media API base URL fallback for /v1/media-request
                                   Falls back to ${FALLBACK_MEDIA_API_BASE_URL_ENV} if unset.
`);
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    printUsage();
    process.exit(0);
  }

  const pagesOnly = args.has('--pages-only');
  const apiOnly = args.has('--api-only');
  if (pagesOnly && apiOnly) {
    throw new Error('Cannot combine --pages-only and --api-only.');
  }

  return {
    shouldCheckPages: !apiOnly,
    shouldCheckApis: !pagesOnly,
  };
}

function isLocalhost(hostname) {
  const value = hostname.toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '::1';
}

function resolveBaseUrl() {
  const configured = process.env[SMOKE_BASE_URL_ENV]?.trim() ?? '';
  if (!configured) {
    throw new Error(`${SMOKE_BASE_URL_ENV} is required.`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(configured);
  } catch {
    throw new Error(`${SMOKE_BASE_URL_ENV} must be a valid absolute URL.`);
  }

  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol === 'http:' && !isLocalhost(parsedUrl.hostname)) {
    throw new Error(`${SMOKE_BASE_URL_ENV} must use https (except localhost).`);
  }
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error(`${SMOKE_BASE_URL_ENV} must use http or https.`);
  }

  parsedUrl.hash = '';
  parsedUrl.search = '';
  parsedUrl.pathname = '/';
  return parsedUrl;
}

function resolveTimeoutMs() {
  const rawValue = process.env[SMOKE_TIMEOUT_MS_ENV]?.trim();
  if (!rawValue) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${SMOKE_TIMEOUT_MS_ENV} must be a positive integer.`);
  }

  return parsedValue;
}

function resolveMaxPages() {
  const rawValue = process.env[SMOKE_MAX_PAGES_ENV]?.trim();
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${SMOKE_MAX_PAGES_ENV} must be a positive integer.`);
  }

  return parsedValue;
}

function resolveOptionalApiBaseUrl({
  primaryEnvName,
  fallbackEnvName,
  baseUrl,
}) {
  const rawValue = (process.env[primaryEnvName] ?? process.env[fallbackEnvName] ?? '').trim();
  if (!rawValue) {
    return null;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawValue, baseUrl);
  } catch {
    throw new Error(
      `${primaryEnvName} (or ${fallbackEnvName}) must be a valid absolute URL or absolute path.`,
    );
  }

  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol === 'http:' && !isLocalhost(parsedUrl.hostname)) {
    throw new Error(`${primaryEnvName} must use https (except localhost).`);
  }
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error(`${primaryEnvName} must use http or https.`);
  }

  parsedUrl.hash = '';
  parsedUrl.search = '';
  parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  return parsedUrl;
}

function buildUrlFromApiBase(apiBaseUrl, endpointPath) {
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const basePath = apiBaseUrl.pathname === '/' ? '' : apiBaseUrl.pathname.replace(/\/+$/, '');
  const requestUrl = new URL(apiBaseUrl.toString());
  requestUrl.pathname = `${basePath}${normalizedPath}`;
  requestUrl.search = '';
  requestUrl.hash = '';
  return requestUrl.toString();
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        ...(init?.headers ?? {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseLocValues(xml) {
  const values = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  let match = regex.exec(xml);
  while (match) {
    const value = (match[1] ?? '').trim();
    if (value) {
      values.push(value);
    }
    match = regex.exec(xml);
  }
  return values;
}

function asAbsoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl);
  } catch {
    return null;
  }
}

function mapUrlToBaseOrigin(url, baseUrl) {
  const mappedUrl = new URL(url.toString());
  mappedUrl.protocol = baseUrl.protocol;
  mappedUrl.hostname = baseUrl.hostname;
  mappedUrl.port = baseUrl.port;
  mappedUrl.hash = '';
  return mappedUrl;
}

async function collectSitemapPageUrls({ baseUrl, timeoutMs }) {
  const initialSitemapUrl = new URL('/sitemap.xml', baseUrl);
  const queue = [initialSitemapUrl.toString()];
  const seenSitemaps = new Set();
  const pageUrls = new Set();

  while (queue.length > 0) {
    const currentSitemap = queue.shift();
    if (!currentSitemap || seenSitemaps.has(currentSitemap)) {
      continue;
    }
    seenSitemaps.add(currentSitemap);

    const response = await fetchWithTimeout(currentSitemap, {}, timeoutMs);
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap ${currentSitemap}: HTTP ${response.status}`);
    }

    const xml = await response.text();
    const locValues = parseLocValues(xml);
    if (locValues.length === 0) {
      continue;
    }

    const isSitemapIndex = xml.includes('<sitemapindex');
    if (isSitemapIndex) {
      for (const locValue of locValues) {
        const resolvedUrl = asAbsoluteUrl(locValue, baseUrl);
        if (!resolvedUrl) {
          continue;
        }
        const mappedUrl = mapUrlToBaseOrigin(resolvedUrl, baseUrl);
        queue.push(mappedUrl.toString());
      }
      continue;
    }

    for (const locValue of locValues) {
      const resolvedUrl = asAbsoluteUrl(locValue, baseUrl);
      if (!resolvedUrl) {
        continue;
      }
      const mappedUrl = mapUrlToBaseOrigin(resolvedUrl, baseUrl);
      mappedUrl.hash = '';
      mappedUrl.search = '';
      pageUrls.add(mappedUrl.toString());
    }
  }

  return [...pageUrls].sort();
}

function buildFallbackPageUrls(baseUrl) {
  const urls = new Set();
  urls.add(new URL('/', baseUrl).toString());

  for (const locale of FALLBACK_LOCALES) {
    for (const routePath of FALLBACK_ROUTE_PATHS) {
      const normalizedPath = routePath === '/' ? `/${locale}/` : `/${locale}${routePath}/`;
      urls.add(new URL(normalizedPath, baseUrl).toString());
    }
  }

  return [...urls].sort();
}

function trimForLog(value, maxLength = 180) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

async function runPageChecks({ baseUrl, timeoutMs, maxPages }) {
  logSection('Page smoke checks');

  let pageUrls = [];
  try {
    pageUrls = await collectSitemapPageUrls({ baseUrl, timeoutMs });
    console.log(`Discovered ${pageUrls.length} page URL(s) from sitemap.`);
    if (pageUrls.length === 0) {
      pageUrls = buildFallbackPageUrls(baseUrl);
      console.log(`Sitemap did not provide page URLs. Using fallback route list with ${pageUrls.length} URL(s).`);
    }
  } catch (error) {
    console.warn(`Sitemap discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    pageUrls = buildFallbackPageUrls(baseUrl);
    console.log(`Using fallback route list with ${pageUrls.length} URL(s).`);
  }

  if (maxPages !== null && pageUrls.length > maxPages) {
    pageUrls = pageUrls.slice(0, maxPages);
    console.log(`Applied ${SMOKE_MAX_PAGES_ENV} limit: checking first ${maxPages} URL(s).`);
  }

  const failures = [];
  let passCount = 0;

  for (const pageUrl of pageUrls) {
    try {
      const response = await fetchWithTimeout(
        pageUrl,
        {
          method: 'GET',
          redirect: 'follow',
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        timeoutMs,
      );

      if (response.status >= 400) {
        const body = trimForLog(await response.text().catch(() => ''));
        failures.push({
          pageUrl,
          status: response.status,
          detail: body || 'no response body',
        });
        console.log(`FAIL ${response.status} ${pageUrl}`);
        continue;
      }

      passCount += 1;
      console.log(`PASS ${response.status} ${pageUrl}`);
    } catch (error) {
      failures.push({
        pageUrl,
        status: null,
        detail: error instanceof Error ? error.message : String(error),
      });
      console.log(`FAIL ERR ${pageUrl}`);
    }
  }

  console.log(`\nPages: ${passCount}/${pageUrls.length} passed.`);
  if (failures.length > 0) {
    console.log('Page failures:');
    for (const failure of failures) {
      const statusLabel = failure.status === null ? 'ERR' : String(failure.status);
      console.log(`- [${statusLabel}] ${failure.pageUrl} :: ${failure.detail}`);
    }
  }

  return {
    total: pageUrls.length,
    passed: passCount,
    failed: failures.length,
  };
}

function buildApiCases(turnstileToken) {
  const uniqueSuffix = Date.now().toString();
  const smokeEmail = `smoke+${uniqueSuffix}@example.com`;
  const normalizedTurnstileToken = turnstileToken?.trim() || 'smoke-test-token';

  return [
    {
      name: 'contact-us CTA endpoint',
      method: 'POST',
      proxyPath: '/www/v1/contact-us',
      directPath: '/v1/contact-us',
      apiBaseType: 'crm',
      body: {
        first_name: 'Smoke',
        email_address: smokeEmail,
        phone_number: '+85290000000',
        message: `Smoke test submission ${uniqueSuffix}`,
      },
      allowedStatuses: new Set([200, 202, 400, 403]),
      expectedStatuses: new Set([200, 202]),
      includeTurnstileHeader: false,
    },
    // Discount validation requires environment-specific seed data and has proven flaky in staging smoke runs.
    {
      name: 'media request CTA endpoint',
      method: 'POST',
      proxyPath: '/www/v1/media-request',
      directPath: '/v1/media-request',
      apiBaseType: 'media',
      body: {
        first_name: 'Smoke',
        email: smokeEmail,
        resource_key: 'smoke-runner',
      },
      allowedStatuses: new Set([202, 400, 403]),
      expectedStatuses: new Set([202]),
      includeTurnstileHeader: true,
      turnstileToken: normalizedTurnstileToken,
    },
    {
      name: 'reservation CTA endpoint',
      method: 'POST',
      proxyPath: '/www/v1/reservations',
      directPath: '/v1/reservations',
      apiBaseType: 'crm',
      body: {
        full_name: 'Smoke Runner',
        email: smokeEmail,
        phone_number: '+85290000000',
        cohort_age: '3-5 years',
        cohort_date: '2030-01-01',
        comments: 'Smoke test reservation',
        price: 1,
        reservation_pending_until_payment_confirmed: true,
        agreed_to_terms_and_conditions: true,
      },
      allowedStatuses: new Set([200, 202, 400, 403]),
      expectedStatuses: new Set([200, 202]),
      includeTurnstileHeader: true,
      turnstileToken: normalizedTurnstileToken,
    },
  ];
}

function buildApiCandidateUrls({
  apiCase,
  baseUrl,
  crmApiBaseUrl,
  mediaApiBaseUrl,
}) {
  const candidateUrls = [new URL(apiCase.proxyPath, baseUrl).toString()];
  if (apiCase.apiBaseType === 'crm' && crmApiBaseUrl) {
    candidateUrls.push(buildUrlFromApiBase(crmApiBaseUrl, apiCase.directPath));
  }
  if (apiCase.apiBaseType === 'media' && mediaApiBaseUrl) {
    candidateUrls.push(buildUrlFromApiBase(mediaApiBaseUrl, apiCase.directPath));
  }
  return [...new Set(candidateUrls)];
}

async function runApiChecks({ baseUrl, timeoutMs, crmApiBaseUrl, mediaApiBaseUrl }) {
  logSection('CTA API smoke checks');

  const apiKey = (process.env[SMOKE_API_KEY_ENV] ?? process.env[FALLBACK_API_KEY_ENV] ?? '').trim();
  if (!apiKey) {
    throw new Error(
      `API checks require ${SMOKE_API_KEY_ENV} (or ${FALLBACK_API_KEY_ENV}) to be set.`,
    );
  }

  const apiCases = buildApiCases(process.env[SMOKE_TURNSTILE_TOKEN_ENV] ?? '');
  const failures = [];
  const warningPasses = [];
  let strictPassCount = 0;

  for (const apiCase of apiCases) {
    const endpointUrls = buildApiCandidateUrls({
      apiCase,
      baseUrl,
      crmApiBaseUrl,
      mediaApiBaseUrl,
    });
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey,
    };
    if (apiCase.includeTurnstileHeader) {
      headers['X-Turnstile-Token'] = apiCase.turnstileToken;
    }

    let hasRecordedOutcome = false;
    let deferredNotFoundFailure = null;

    for (const [candidateIndex, endpointUrl] of endpointUrls.entries()) {
      try {
        const response = await fetchWithTimeout(
          endpointUrl,
          {
            method: apiCase.method,
            headers,
            body: JSON.stringify(apiCase.body),
            redirect: 'follow',
          },
          timeoutMs,
        );
        const responseBody = trimForLog(await response.text().catch(() => ''));
        const endpointSuffix =
          endpointUrls.length > 1 && candidateIndex > 0 ? ' (fallback endpoint)' : '';

        if (response.status === 404 && candidateIndex < endpointUrls.length - 1) {
          deferredNotFoundFailure = {
            name: apiCase.name,
            status: response.status,
            detail: `${responseBody || 'endpoint not found'} (endpoint: ${endpointUrl})`,
          };
          continue;
        }

        if (response.status >= 500) {
          failures.push({
            name: apiCase.name,
            status: response.status,
            detail: `${responseBody || 'server error without response body'} (endpoint: ${endpointUrl})`,
          });
          console.log(`FAIL ${response.status} ${apiCase.name}${endpointSuffix}`);
          hasRecordedOutcome = true;
          break;
        }

        if (!apiCase.allowedStatuses.has(response.status)) {
          failures.push({
            name: apiCase.name,
            status: response.status,
            detail: `${responseBody || 'unexpected status code'} (endpoint: ${endpointUrl})`,
          });
          console.log(`FAIL ${response.status} ${apiCase.name}${endpointSuffix}`);
          hasRecordedOutcome = true;
          break;
        }

        if (apiCase.expectedStatuses.has(response.status)) {
          strictPassCount += 1;
          console.log(`PASS ${response.status} ${apiCase.name}${endpointSuffix}`);
          hasRecordedOutcome = true;
          break;
        }

        warningPasses.push({
          name: apiCase.name,
          status: response.status,
          detail: `${responseBody || 'validation/security gate'} (endpoint: ${endpointUrl})`,
        });
        console.log(
          `PASS* ${response.status} ${apiCase.name}${endpointSuffix} (validation/security gate)`,
        );
        hasRecordedOutcome = true;
        break;
      } catch (error) {
        failures.push({
          name: apiCase.name,
          status: null,
          detail: error instanceof Error ? error.message : String(error),
        });
        console.log(`FAIL ERR ${apiCase.name}`);
        hasRecordedOutcome = true;
        break;
      }
    }

    if (!hasRecordedOutcome) {
      failures.push(
        deferredNotFoundFailure ?? {
          name: apiCase.name,
          status: 404,
          detail: 'endpoint not found',
        },
      );
      console.log(`FAIL 404 ${apiCase.name}`);
    }
  }

  console.log(
    `\nAPIs: ${strictPassCount} strict pass(es), ${warningPasses.length} guarded pass(es), ${failures.length} failure(s).`,
  );

  if (warningPasses.length > 0) {
    console.log('Guarded API passes (request reached endpoint but was blocked by validation/auth):');
    for (const entry of warningPasses) {
      console.log(`- [${entry.status}] ${entry.name} :: ${entry.detail}`);
    }
  }

  if (failures.length > 0) {
    console.log('API failures:');
    for (const failure of failures) {
      const statusLabel = failure.status === null ? 'ERR' : String(failure.status);
      console.log(`- [${statusLabel}] ${failure.name} :: ${failure.detail}`);
    }
  }

  return {
    total: apiCases.length,
    passed: strictPassCount + warningPasses.length,
    strictPassed: strictPassCount,
    guardedPassed: warningPasses.length,
    failed: failures.length,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = resolveBaseUrl();
  const timeoutMs = resolveTimeoutMs();
  const maxPages = resolveMaxPages();
  const crmApiBaseUrl = resolveOptionalApiBaseUrl({
    primaryEnvName: SMOKE_CRM_API_BASE_URL_ENV,
    fallbackEnvName: FALLBACK_CRM_API_BASE_URL_ENV,
    baseUrl,
  });
  const mediaApiBaseUrl = resolveOptionalApiBaseUrl({
    primaryEnvName: SMOKE_MEDIA_API_BASE_URL_ENV,
    fallbackEnvName: FALLBACK_MEDIA_API_BASE_URL_ENV,
    baseUrl,
  });

  logSection('Smoke runner configuration');
  console.log(`Base URL: ${baseUrl.toString()}`);
  console.log(`Timeout: ${timeoutMs}ms`);
  if (maxPages !== null) {
    console.log(`Max pages: ${maxPages}`);
  }
  if (crmApiBaseUrl) {
    console.log(`CRM API fallback base: ${crmApiBaseUrl.toString()}`);
  }
  if (mediaApiBaseUrl) {
    console.log(`Media API fallback base: ${mediaApiBaseUrl.toString()}`);
  }

  const results = [];
  if (args.shouldCheckPages) {
    results.push(await runPageChecks({ baseUrl, timeoutMs, maxPages }));
  }
  if (args.shouldCheckApis) {
    results.push(await runApiChecks({ baseUrl, timeoutMs, crmApiBaseUrl, mediaApiBaseUrl }));
  }

  const hasFailures = results.some((result) => result.failed > 0);
  if (hasFailures) {
    console.log('\nSmoke run finished with failures.');
    process.exit(1);
  }

  console.log('\nSmoke run passed.');
}

main().catch((error) => {
  console.error('Smoke run crashed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
