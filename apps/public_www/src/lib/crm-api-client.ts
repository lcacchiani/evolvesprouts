export type CrmApiMethod = 'GET' | 'POST' | 'PUT';

export interface CrmApiClientConfig {
  baseUrl: string;
  apiKey: string;
}

export interface CrmApiRequestOptions {
  endpointPath: string;
  method?: CrmApiMethod;
  signal?: AbortSignal;
  body?: unknown;
  headers?: Record<string, string>;
  turnstileToken?: string;
  expectedSuccessStatuses?: readonly number[];
}

export interface CrmApiClient {
  request: (options: CrmApiRequestOptions) => Promise<unknown>;
}

interface CachedGetEntry {
  expiresAt: number;
  payload: unknown;
}

export class CrmApiRequestError extends Error {
  readonly statusCode: number;
  readonly payload: unknown;

  constructor({
    statusCode,
    payload,
    message,
  }: {
    statusCode: number;
    payload: unknown;
    message: string;
  }) {
    super(message);
    this.name = 'CrmApiRequestError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export const CRM_GET_CACHE_TTL_MS = 5 * 60 * 1000;
export const CRM_GET_CACHE_MAX_ENTRIES = 100;
const CRM_GET_CACHE_SWEEP_WRITE_INTERVAL = 25;

const getRequestCache = new Map<string, CachedGetEntry>();
let getCacheWriteCount = 0;
const WWW_PROXY_ALLOWED_HOSTS_ENV_NAME = 'NEXT_PUBLIC_WWW_PROXY_ALLOWED_HOSTS';
const CRM_API_BASE_URL_ENV_NAME = 'NEXT_PUBLIC_WWW_CRM_API_BASE_URL';
const WWW_API_PATH_PREFIX = '/www';

function normalizeBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim();
  if (!normalizedBaseUrl) {
    return '';
  }

  if (normalizedBaseUrl.startsWith('/')) {
    return normalizeRelativeBaseUrl(normalizedBaseUrl);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedBaseUrl);
  } catch {
    return '';
  }

  if (parsedUrl.protocol.toLowerCase() !== 'https:') {
    return '';
  }
  const configuredApiHostname = resolveConfiguredApiHostname();
  if (
    configuredApiHostname &&
    parsedUrl.hostname.toLowerCase() !== configuredApiHostname
  ) {
    return '';
  }

  const normalizedPathname = normalizeAbsolutePathname(parsedUrl.pathname);
  if (normalizedPathname !== WWW_API_PATH_PREFIX) {
    return '';
  }
  if (shouldUsePublicWwwProxy(parsedUrl.hostname, normalizedPathname)) {
    return normalizedPathname;
  }

  return `${parsedUrl.origin}${normalizedPathname}`;
}

function normalizeRelativeBaseUrl(baseUrl: string): string {
  const normalizedPath = baseUrl.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalizedPath) {
    return '';
  }

  const normalizedBasePath = `/${normalizedPath}`;
  if (normalizedBasePath !== WWW_API_PATH_PREFIX) {
    return '';
  }

  return normalizedBasePath;
}

function normalizeAbsolutePathname(pathname: string): string {
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (!normalizedPath || normalizedPath === '/') {
    return '';
  }

  return normalizedPath;
}

function resolveConfiguredApiHostname(): string | null {
  const configuredBaseUrl = process.env[CRM_API_BASE_URL_ENV_NAME]?.trim() ?? '';
  if (!configuredBaseUrl || configuredBaseUrl.startsWith('/')) {
    return null;
  }

  try {
    const parsedUrl = new URL(configuredBaseUrl);
    if (parsedUrl.protocol.toLowerCase() !== 'https:') {
      return null;
    }
    const normalizedPathname = normalizeAbsolutePathname(parsedUrl.pathname);
    if (normalizedPathname !== WWW_API_PATH_PREFIX) {
      return null;
    }
    return parsedUrl.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function resolveProxyAllowedHosts(): Set<string> {
  const rawHosts = process.env[WWW_PROXY_ALLOWED_HOSTS_ENV_NAME]?.trim() ?? '';
  if (!rawHosts) {
    return new Set();
  }
  return new Set(
    rawHosts
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0),
  );
}

function shouldUsePublicWwwProxy(apiHostname: string, apiPathname: string): boolean {
  if (!apiPathname.startsWith(WWW_API_PATH_PREFIX)) {
    return false;
  }
  const configuredApiHostname = resolveConfiguredApiHostname();
  if (configuredApiHostname && apiHostname.toLowerCase() !== configuredApiHostname) {
    return false;
  }

  const currentHostname =
    typeof location === 'undefined' ? '' : location.hostname.toLowerCase();

  return resolveProxyAllowedHosts().has(currentHostname);
}

function normalizeEndpointPath(endpointPath: string): string {
  const normalizedPath = endpointPath.trim();
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

function parseResponsePayload(response: Response): Promise<unknown> {
  return response.text().then((rawText) => {
    const normalizedText = rawText.trim();
    if (!normalizedText) {
      return null;
    }

    try {
      return JSON.parse(normalizedText) as unknown;
    } catch {
      return normalizedText;
    }
  });
}

function buildGetCacheKey(apiKey: string, requestUrl: string): string {
  return `${apiKey}::${requestUrl}`;
}

function pruneExpiredGetCacheEntries(now: number): void {
  for (const [cacheKey, cacheEntry] of getRequestCache.entries()) {
    if (cacheEntry.expiresAt <= now) {
      getRequestCache.delete(cacheKey);
    }
  }
}

function evictOldestGetCacheEntry(): void {
  const oldestCacheEntry = getRequestCache.keys().next();
  if (oldestCacheEntry.done) {
    return;
  }

  getRequestCache.delete(oldestCacheEntry.value);
}

function setGetCacheEntry(cacheKey: string, payload: unknown): void {
  const now = Date.now();
  getRequestCache.set(cacheKey, {
    payload,
    expiresAt: now + CRM_GET_CACHE_TTL_MS,
  });

  getCacheWriteCount += 1;
  if (getCacheWriteCount % CRM_GET_CACHE_SWEEP_WRITE_INTERVAL === 0) {
    pruneExpiredGetCacheEntries(now);
  }

  while (getRequestCache.size > CRM_GET_CACHE_MAX_ENTRIES) {
    evictOldestGetCacheEntry();
  }
}

export function buildCrmApiUrl(baseUrl: string, endpointPath: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPath = normalizeEndpointPath(endpointPath);
  if (!normalizedBaseUrl || !normalizedPath) {
    return '';
  }

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function createCrmApiClient(config: CrmApiClientConfig): CrmApiClient | null {
  const normalizedApiKey = config.apiKey.trim();
  const normalizedBaseUrl = normalizeBaseUrl(config.baseUrl);
  if (!normalizedApiKey || !normalizedBaseUrl) {
    return null;
  }

  return {
    async request(options: CrmApiRequestOptions): Promise<unknown> {
      const method = options.method ?? 'GET';
      const requestUrl = buildCrmApiUrl(normalizedBaseUrl, options.endpointPath);
      if (!requestUrl) {
        throw new Error('CRM API endpoint path is invalid');
      }

      const cacheKey = buildGetCacheKey(normalizedApiKey, requestUrl);
      if (method === 'GET') {
        const now = Date.now();
        const cachedEntry = getRequestCache.get(cacheKey);
        if (cachedEntry && cachedEntry.expiresAt > now) {
          // Refresh insertion order so active keys remain in cache during eviction.
          getRequestCache.delete(cacheKey);
          getRequestCache.set(cacheKey, cachedEntry);
          return cachedEntry.payload;
        }
        if (cachedEntry) {
          getRequestCache.delete(cacheKey);
        }
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'x-api-key': normalizedApiKey,
        ...options.headers,
      };
      const normalizedTurnstileToken = options.turnstileToken?.trim() ?? '';
      if (normalizedTurnstileToken) {
        headers['X-Turnstile-Token'] = normalizedTurnstileToken;
      }

      const requestInit: RequestInit = {
        method,
        signal: options.signal,
        headers,
      };

      if (method !== 'GET' && options.body !== undefined) {
        requestInit.body = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(requestUrl, requestInit);
      const payload = await parseResponsePayload(response);
      if (!response.ok) {
        throw new CrmApiRequestError({
          statusCode: response.status,
          payload,
          message: `CRM API request failed: ${response.status}`,
        });
      }

      const expectedSuccessStatuses = options.expectedSuccessStatuses;
      if (
        expectedSuccessStatuses &&
        expectedSuccessStatuses.length > 0 &&
        !expectedSuccessStatuses.includes(response.status)
      ) {
        throw new CrmApiRequestError({
          statusCode: response.status,
          payload,
          message: `CRM API request returned unexpected status: ${response.status}`,
        });
      }

      if (method === 'GET') {
        setGetCacheEntry(cacheKey, payload);
      } else {
        getRequestCache.delete(cacheKey);
      }

      return payload;
    },
  };
}

export function createPublicCrmApiClient(): CrmApiClient | null {
  return createCrmApiClient({
    baseUrl: process.env.NEXT_PUBLIC_WWW_CRM_API_BASE_URL ?? '',
    apiKey: process.env.NEXT_PUBLIC_WWW_CRM_API_KEY ?? '',
  });
}

export function isAbortRequestError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function clearCrmApiGetCacheForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearCrmApiGetCacheForTests() can only run in test mode.');
  }

  getRequestCache.clear();
  getCacheWriteCount = 0;
}
