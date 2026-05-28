import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchPollControlState,
  fetchPollQuestionResults,
  fetchPollSessionAnswers,
  persistPollControlState,
  PollApiError,
  resolvePollApiConfig,
} from '@/lib/polls-api';

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

describe('fetchPollQuestionResults', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requests results with questionType query param', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/www');
    vi.stubEnv('NEXT_PUBLIC_TRAINING_API_KEY', 'poll-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pollSlug: 'workshop-food-jun-26',
        questionId: 'role',
        questionType: 'select',
        totalResponses: 0,
        buckets: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchPollQuestionResults({
      pollSlug: 'workshop-food-jun-26',
      questionId: 'role',
      questionType: 'select',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/www/v1/polls/workshop-food-jun-26/questions/role/results?questionType=select',
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-api-key': 'poll-key' },
      }),
    );
  });
});

describe('fetchPollSessionAnswers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requests session answers with sessionId query param', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/www');
    vi.stubEnv('NEXT_PUBLIC_TRAINING_API_KEY', 'poll-key');
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pollSlug: 'workshop-food-jun-26',
        sessionId,
        answers: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchPollSessionAnswers('workshop-food-jun-26', sessionId);

    expect(fetchMock).toHaveBeenCalledWith(
      `/www/v1/polls/workshop-food-jun-26/answers?sessionId=${sessionId}`,
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-api-key': 'poll-key' },
      }),
    );
  });
});

describe('poll control API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('loads control state', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/www');
    vi.stubEnv('NEXT_PUBLIC_TRAINING_API_KEY', 'poll-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pollSlug: 'workshop-food-jun-26',
        enabledQuestionIds: ['role'],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const state = await fetchPollControlState('workshop-food-jun-26');
    expect(state.enabledQuestionIds).toEqual(['role']);
    expect(fetchMock).toHaveBeenCalledWith(
      '/www/v1/polls/workshop-food-jun-26/control',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('persists control state', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/www');
    vi.stubEnv('NEXT_PUBLIC_TRAINING_API_KEY', 'poll-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pollSlug: 'workshop-food-jun-26',
        enabledQuestionIds: ['myth1'],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await persistPollControlState('workshop-food-jun-26', ['myth1']);

    expect(fetchMock).toHaveBeenCalledWith(
      '/www/v1/polls/workshop-food-jun-26/control',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ enabledQuestionIds: ['myth1'] }),
      }),
    );
  });
});

describe('PollApiError', () => {
  it('exposes statusCode', () => {
    const error = new PollApiError('Failed', 403);
    expect(error.statusCode).toBe(403);
    expect(error.name).toBe('PollApiError');
  });
});
