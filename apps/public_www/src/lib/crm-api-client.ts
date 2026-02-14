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
}

export interface CrmApiClient {
  request: (options: CrmApiRequestOptions) => Promise<unknown>;
}

interface CachedGetEntry {
  expiresAt: number;
  payload: unknown;
}

export const CRM_GET_CACHE_TTL_MS = 5 * 60 * 1000;

const getRequestCache = new Map<string, CachedGetEntry>();

function normalizeBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim();
  if (!normalizedBaseUrl || !/^https:\/\//i.test(normalizedBaseUrl)) {
    return '';
  }

  return normalizedBaseUrl.replace(/\/+$/, '');
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
      if (!response.ok) {
        throw new Error(`CRM API request failed: ${response.status}`);
      }

      const payload = await parseResponsePayload(response);
      if (method === 'GET') {
        getRequestCache.set(cacheKey, {
          payload,
          expiresAt: Date.now() + CRM_GET_CACHE_TTL_MS,
        });
      } else {
        getRequestCache.delete(cacheKey);
      }

      return payload;
    },
  };
}

export function clearCrmApiGetCacheForTests(): void {
  getRequestCache.clear();
}
