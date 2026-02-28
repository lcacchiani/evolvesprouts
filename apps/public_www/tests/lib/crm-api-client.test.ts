import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CrmApiRequestError,
  CRM_GET_CACHE_TTL_MS,
  CRM_GET_CACHE_MAX_ENTRIES,
  buildCrmApiUrl,
  clearCrmApiGetCacheForTests,
  createCrmApiClient,
} from '@/lib/crm-api-client';

afterEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  clearCrmApiGetCacheForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('crm-api-client', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_WWW_CRM_API_BASE_URL', 'https://api.evolvesprouts.com/www');
    vi.stubEnv(
      'NEXT_PUBLIC_WWW_PROXY_ALLOWED_HOSTS',
      'www.evolvesprouts.com,www-staging.evolvesprouts.com',
    );
  });

  it('builds endpoint URLs from base URL and endpoint path', () => {
    expect(buildCrmApiUrl('https://api.evolvesprouts.com/www', '/v1/discounts')).toBe(
      'https://api.evolvesprouts.com/www/v1/discounts',
    );
    expect(buildCrmApiUrl('https://api.evolvesprouts.com/www/', 'v1/discounts')).toBe(
      'https://api.evolvesprouts.com/www/v1/discounts',
    );
    expect(buildCrmApiUrl('/www', '/v1/discounts')).toBe('/www/v1/discounts');
    expect(buildCrmApiUrl('/www/', 'v1/discounts')).toBe('/www/v1/discounts');
    expect(buildCrmApiUrl('/api', '/v1/discounts')).toBe('');
    expect(buildCrmApiUrl('//api.evolvesprouts.com/www', '/v1/discounts')).toBe('');
    expect(buildCrmApiUrl('https://example.com/www', '/v1/discounts')).toBe('');
    expect(buildCrmApiUrl('https://api.evolvesprouts.com/admin', '/v1/discounts')).toBe(
      '',
    );
    expect(buildCrmApiUrl('api.evolvesprouts.com/www', '/v1/discounts')).toBe('');
    expect(buildCrmApiUrl('/', '/v1/discounts')).toBe('');
    expect(buildCrmApiUrl('   ', '/v1/discounts')).toBe('');
  });

  it('rewrites api.evolvesprouts.com URLs to same-origin proxy on public hosts', () => {
    vi.stubGlobal('location', new URL('https://www-staging.evolvesprouts.com/en/events'));

    expect(buildCrmApiUrl('https://api.evolvesprouts.com/www', '/v1/discounts')).toBe(
      '/www/v1/discounts',
    );
    expect(buildCrmApiUrl('https://api.evolvesprouts.com/www/', 'v1/calendar/events')).toBe(
      '/www/v1/calendar/events',
    );
  });

  it('does not rewrite absolute URLs when proxy host allowlist is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_WWW_PROXY_ALLOWED_HOSTS', '');
    vi.stubGlobal('location', new URL('https://www-staging.evolvesprouts.com/en/events'));

    expect(buildCrmApiUrl('https://api.evolvesprouts.com/www', '/v1/discounts')).toBe(
      'https://api.evolvesprouts.com/www/v1/discounts',
    );
  });

  it('returns null when base URL or API key is invalid', () => {
    expect(
      createCrmApiClient({
        baseUrl: 'api.evolvesprouts.com/www',
        apiKey: 'public-key',
      }),
    ).toBeNull();
    expect(
      createCrmApiClient({
        baseUrl: 'https://example.com/www',
        apiKey: 'public-key',
      }),
    ).toBeNull();
    expect(
      createCrmApiClient({
        baseUrl: '/admin',
        apiKey: 'public-key',
      }),
    ).toBeNull();
    expect(
      createCrmApiClient({
        baseUrl: 'https://api.evolvesprouts.com/www',
        apiKey: '   ',
      }),
    ).toBeNull();
  });

  it('sends GET requests with expected headers', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const client = createCrmApiClient({
      baseUrl: 'https://api.evolvesprouts.com/www',
      apiKey: 'public-key',
    });
    if (!client) {
      throw new Error('Expected CRM API client to be configured');
    }

    await client.request({
      endpointPath: '/v1/discounts',
      method: 'GET',
      signal: new AbortController().signal,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.evolvesprouts.com/www/v1/discounts',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'x-api-key': 'public-key',
        }),
      }),
    );
  });

  it('caches GET responses for five minutes', async () => {
    expect(CRM_GET_CACHE_TTL_MS).toBe(5 * 60 * 1000);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const fetchSpy = vi.fn();
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: ['first'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: ['second'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const client = createCrmApiClient({
      baseUrl: 'https://api.evolvesprouts.com/www',
      apiKey: 'public-key',
    });
    if (!client) {
      throw new Error('Expected CRM API client to be configured');
    }

    const firstResponse = await client.request({
      endpointPath: '/v1/calendar/events',
      method: 'GET',
    });
    vi.setSystemTime(new Date('2026-01-01T00:04:59.000Z'));
    const cachedResponse = await client.request({
      endpointPath: '/v1/calendar/events',
      method: 'GET',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(cachedResponse).toEqual(firstResponse);

    vi.setSystemTime(new Date('2026-01-01T00:05:00.001Z'));
    const refreshedResponse = await client.request({
      endpointPath: '/v1/calendar/events',
      method: 'GET',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(refreshedResponse).toEqual({ data: ['second'] });
  });

  it('evicts oldest GET cache entries after reaching max size', async () => {
    const fetchSpy = vi.fn(async (requestUrl: string) => {
      return new Response(JSON.stringify({ requestUrl }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const client = createCrmApiClient({
      baseUrl: 'https://api.evolvesprouts.com/www',
      apiKey: 'public-key',
    });
    if (!client) {
      throw new Error('Expected CRM API client to be configured');
    }

    for (let index = 0; index <= CRM_GET_CACHE_MAX_ENTRIES; index += 1) {
      await client.request({
        endpointPath: `/v1/events/${index}`,
        method: 'GET',
      });
    }

    expect(fetchSpy).toHaveBeenCalledTimes(CRM_GET_CACHE_MAX_ENTRIES + 1);

    await client.request({
      endpointPath: '/v1/events/0',
      method: 'GET',
    });
    await client.request({
      endpointPath: `/v1/events/${CRM_GET_CACHE_MAX_ENTRIES}`,
      method: 'GET',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(CRM_GET_CACHE_MAX_ENTRIES + 2);
  });

  it('sends JSON bodies for POST and PUT requests', async () => {
    const fetchSpy = vi.fn();
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const client = createCrmApiClient({
      baseUrl: 'https://api.evolvesprouts.com/www',
      apiKey: 'public-key',
    });
    if (!client) {
      throw new Error('Expected CRM API client to be configured');
    }

    await client.request({
      endpointPath: '/v1/test-endpoint',
      method: 'POST',
      body: { name: 'sprout' },
      turnstileToken: 'turnstile-token',
    });
    await client.request({
      endpointPath: '/v1/test-endpoint',
      method: 'PUT',
      body: { status: 'updated' },
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://api.evolvesprouts.com/www/v1/test-endpoint',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'sprout' }),
        headers: expect.objectContaining({
          Accept: 'application/json',
          'x-api-key': 'public-key',
          'Content-Type': 'application/json',
          'X-Turnstile-Token': 'turnstile-token',
        }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.evolvesprouts.com/www/v1/test-endpoint',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ status: 'updated' }),
        headers: expect.objectContaining({
          Accept: 'application/json',
          'x-api-key': 'public-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws when status code is not in expected success statuses', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'created' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const client = createCrmApiClient({
      baseUrl: 'https://api.evolvesprouts.com/www',
      apiKey: 'public-key',
    });
    if (!client) {
      throw new Error('Expected CRM API client to be configured');
    }

    await expect(
      client.request({
        endpointPath: '/v1/test-endpoint',
        method: 'POST',
        body: { name: 'sprout' },
        expectedSuccessStatuses: [200, 202],
      }),
    ).rejects.toBeInstanceOf(CrmApiRequestError);
  });

  it('rejects cache clear helper outside test environment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => clearCrmApiGetCacheForTests()).toThrow(
      'clearCrmApiGetCacheForTests() can only run in test mode.',
    );
  });
});
