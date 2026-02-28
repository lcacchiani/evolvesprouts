import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EnvSnapshot = NodeJS.ProcessEnv;

const ENV_KEYS = [
  'NEXT_PUBLIC_COGNITO_DOMAIN',
  'NEXT_PUBLIC_COGNITO_CLIENT_ID',
  'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
  'NEXT_PUBLIC_ADMIN_API_BASE_URL',
] as const;

function setConfigEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      process.env[key] = overrides[key];
    } else {
      delete process.env[key];
    }
  }
}

async function loadConfigModule(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  setConfigEnv(overrides);
  vi.resetModules();
  return import('@/lib/config');
}

describe('config helpers', () => {
  let originalEnv: EnvSnapshot;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('returns missing config errors', async () => {
    const config = await loadConfigModule({});
    expect(config.getConfigErrors()).toEqual([
      'NEXT_PUBLIC_COGNITO_DOMAIN is missing.',
      'NEXT_PUBLIC_COGNITO_CLIENT_ID is missing.',
      'NEXT_PUBLIC_COGNITO_USER_POOL_ID is missing.',
    ]);
  });

  it('normalizes absolute admin API base URL and trims trailing slashes', async () => {
    const config = await loadConfigModule({
      NEXT_PUBLIC_COGNITO_DOMAIN: 'auth.example.com',
      NEXT_PUBLIC_COGNITO_CLIENT_ID: 'client-id',
      NEXT_PUBLIC_COGNITO_USER_POOL_ID: 'pool-id',
      NEXT_PUBLIC_ADMIN_API_BASE_URL: 'https://api.example.com/base/path///',
    });

    expect(config.getAdminApiConfigError()).toBe('');
    expect(config.getAdminApiBaseUrl()).toBe('https://api.example.com/base/path');
  });

  it('normalizes relative admin API base path', async () => {
    const config = await loadConfigModule({
      NEXT_PUBLIC_COGNITO_DOMAIN: 'auth.example.com',
      NEXT_PUBLIC_COGNITO_CLIENT_ID: 'client-id',
      NEXT_PUBLIC_COGNITO_USER_POOL_ID: 'pool-id',
      NEXT_PUBLIC_ADMIN_API_BASE_URL: '///prod///',
    });

    expect(config.getAdminApiBaseUrl()).toBe('/prod');
  });

  it('returns validation error for invalid admin API base URL', async () => {
    const config = await loadConfigModule({
      NEXT_PUBLIC_COGNITO_DOMAIN: 'auth.example.com',
      NEXT_PUBLIC_COGNITO_CLIENT_ID: 'client-id',
      NEXT_PUBLIC_COGNITO_USER_POOL_ID: 'pool-id',
      NEXT_PUBLIC_ADMIN_API_BASE_URL: 'ftp://api.example.com',
    });

    expect(config.getAdminApiConfigError()).toBe(
      'NEXT_PUBLIC_ADMIN_API_BASE_URL is invalid. Use an absolute URL or relative path.'
    );
    expect(() => config.getAdminApiBaseUrl()).toThrow(
      'NEXT_PUBLIC_ADMIN_API_BASE_URL is invalid. Use an absolute URL or relative path.'
    );
  });

  it('normalizes cognito domain and applies https when protocol is missing', async () => {
    const config = await loadConfigModule({
      NEXT_PUBLIC_COGNITO_DOMAIN: 'auth.example.com///',
      NEXT_PUBLIC_COGNITO_CLIENT_ID: 'client-id',
      NEXT_PUBLIC_COGNITO_USER_POOL_ID: 'pool-id',
      NEXT_PUBLIC_ADMIN_API_BASE_URL: '/prod',
    });

    expect(config.getCognitoDomain()).toBe('https://auth.example.com');
  });
});
