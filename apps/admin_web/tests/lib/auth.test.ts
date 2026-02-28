import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const AUTH_ENV = {
  NEXT_PUBLIC_COGNITO_DOMAIN: 'auth.example.com',
  NEXT_PUBLIC_COGNITO_CLIENT_ID: 'client-id',
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: 'user-pool-id',
  NEXT_PUBLIC_ADMIN_API_BASE_URL: '/prod',
} as const;

function setAuthEnv() {
  Object.entries(AUTH_ENV).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

function base64UrlEncode(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createJwt(payload: Record<string, unknown>) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

async function loadAuthModule() {
  setAuthEnv();
  vi.resetModules();
  return import('@/lib/auth');
}

describe('auth helpers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setAuthEnv();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
  });

  it('parses user profile from JWT claims', async () => {
    const auth = await loadAuthModule();
    const idToken = createJwt({
      email: 'admin@example.com',
      sub: 'user-sub-123',
      'cognito:groups': ['admins', 'ops'],
      auth_time: 1_700_000_000,
    });
    const accessToken = createJwt({});

    const profile = auth.getUserProfile({
      accessToken,
      idToken,
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 3600_000,
    });

    expect(profile.email).toBe('admin@example.com');
    expect(profile.subject).toBe('user-sub-123');
    expect(profile.groups).toEqual(['admins', 'ops']);
    expect(profile.lastAuthTime).toBe('2023-11-14T22:13:20.000Z');
  });

  it('returns current tokens when not near expiry', async () => {
    const auth = await loadAuthModule();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const fetchMock = vi.mocked(fetch);

    window.localStorage.setItem(
      'admin_auth_tokens',
      JSON.stringify({
        accessToken: 'access',
        idToken: 'id',
        refreshToken: 'refresh',
        expiresAt: 1_700_000_200_000,
      })
    );

    const tokens = await auth.ensureFreshTokens();

    expect(tokens).toEqual({
      accessToken: 'access',
      idToken: 'id',
      refreshToken: 'refresh',
      expiresAt: 1_700_000_200_000,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('refreshes expired tokens using refresh token and stores new values', async () => {
    const auth = await loadAuthModule();
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const fetchMock = vi.mocked(fetch);

    window.localStorage.setItem(
      'admin_auth_tokens',
      JSON.stringify({
        accessToken: 'old-access',
        idToken: 'old-id',
        refreshToken: 'old-refresh',
        expiresAt: 1_700_000_010_000,
      })
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-access',
        id_token: 'new-id',
        refresh_token: 'new-refresh',
        expires_in: 600,
      }),
    } as Response);

    const refreshed = await auth.ensureFreshTokens();

    expect(refreshed).toMatchObject({
      accessToken: 'new-access',
      idToken: 'new-id',
      refreshToken: 'new-refresh',
    });

    const stored = JSON.parse(window.localStorage.getItem('admin_auth_tokens') ?? '{}');
    expect(stored.accessToken).toBe('new-access');
    expect(stored.idToken).toBe('new-id');
    expect(stored.refreshToken).toBe('new-refresh');
  });

  it('stores tokens from passwordless flow', async () => {
    const auth = await loadAuthModule();

    auth.storeTokensFromPasswordless({
      accessToken: 'pwd-access',
      idToken: 'pwd-id',
      refreshToken: 'pwd-refresh',
      expiresAt: 1_700_000_200_000,
    });

    const stored = JSON.parse(window.localStorage.getItem('admin_auth_tokens') ?? '{}');
    expect(stored).toEqual({
      accessToken: 'pwd-access',
      idToken: 'pwd-id',
      refreshToken: 'pwd-refresh',
      expiresAt: 1_700_000_200_000,
    });
  });
});
