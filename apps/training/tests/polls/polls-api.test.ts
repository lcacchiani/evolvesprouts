import { afterEach, describe, expect, it, vi } from 'vitest';

import { PollApiError, resolvePollApiConfig } from '@/lib/polls-api';

describe('resolvePollApiConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns same-origin /www when API base URL is relative', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/www');
    vi.stubEnv('NEXT_PUBLIC_TRAINING_API_KEY', 'poll-key');

    expect(resolvePollApiConfig()).toEqual({ baseUrl: '/www', apiKey: 'poll-key' });
  });

  it('returns absolute /www origin when API base URL includes /www path', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://training.example.com/www');
    vi.stubEnv('NEXT_PUBLIC_TRAINING_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_WWW_CRM_API_KEY', 'crm-key');

    expect(resolvePollApiConfig()).toEqual({
      baseUrl: 'https://training.example.com/www',
      apiKey: 'crm-key',
    });
  });

  it('returns null when API base URL is execute-api /prod (shared CDK var)', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_API_BASE_URL',
      'https://8ne5rez7pa.execute-api.ap-southeast-1.amazonaws.com/prod',
    );
    vi.stubEnv('NEXT_PUBLIC_TRAINING_API_KEY', 'poll-key');

    expect(resolvePollApiConfig()).toBeNull();
  });

  it('returns null when API key is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/www');
    vi.stubEnv('NEXT_PUBLIC_TRAINING_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_WWW_CRM_API_KEY', '');

    expect(resolvePollApiConfig()).toBeNull();
  });
});

describe('PollApiError', () => {
  it('exposes statusCode', () => {
    const error = new PollApiError('Failed', 403);
    expect(error.statusCode).toBe(403);
    expect(error.name).toBe('PollApiError');
  });
});
