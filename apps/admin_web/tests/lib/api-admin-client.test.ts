import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnsureFreshTokens, mockGetAdminApiBaseUrl } = vi.hoisted(() => ({
  mockEnsureFreshTokens: vi.fn(),
  mockGetAdminApiBaseUrl: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  ensureFreshTokens: mockEnsureFreshTokens,
}));

vi.mock('@/lib/config', () => ({
  getAdminApiBaseUrl: mockGetAdminApiBaseUrl,
}));

import { AdminApiError, adminApiRequest, isAbortRequestError } from '@/lib/api-admin-client';

describe('adminApiRequest', () => {
  beforeEach(() => {
    mockEnsureFreshTokens.mockReset();
    mockGetAdminApiBaseUrl.mockReset();
    vi.mocked(fetch).mockReset();

    mockEnsureFreshTokens.mockResolvedValue({
      idToken: 'id-token',
    });
    mockGetAdminApiBaseUrl.mockReturnValue('https://api.example.com');
  });

  it('sends authorized request and returns parsed payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    } as Response);

    const payload = await adminApiRequest({
      endpointPath: 'v1/admin/assets',
      method: 'POST',
      body: { title: 'Guide' },
    });

    expect(payload).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/admin/assets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Guide' }),
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer id-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('throws AdminApiError with extracted message on API failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: 'Forbidden', detail: 'Missing role' }),
    } as Response);

    await expect(
      adminApiRequest({
        endpointPath: '/v1/admin/assets',
        method: 'GET',
      })
    ).rejects.toMatchObject({
      name: 'AdminApiError',
      statusCode: 403,
      message: 'Forbidden (Missing role)',
    });
  });

  it('throws when response status is not in expected success statuses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 202,
      text: async () => '{}',
    } as Response);

    await expect(
      adminApiRequest({
        endpointPath: '/v1/admin/assets',
        expectedSuccessStatuses: [200],
      })
    ).rejects.toMatchObject({
      name: 'AdminApiError',
      statusCode: 202,
      message: 'Admin API request returned unexpected status: 202',
    });
  });

  it('throws clear errors for invalid endpoint and missing session', async () => {
    await expect(
      adminApiRequest({
        endpointPath: '   ',
      })
    ).rejects.toThrow('Admin API endpoint path is invalid.');

    mockEnsureFreshTokens.mockResolvedValueOnce(null);
    await expect(
      adminApiRequest({
        endpointPath: '/v1/admin/assets',
      })
    ).rejects.toThrow('Your session has expired. Please sign in again.');
  });

  it('detects AbortError instances', () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';

    expect(isAbortRequestError(abortError)).toBe(true);
    expect(isAbortRequestError(new Error('other'))).toBe(false);
  });

  it('exposes AdminApiError payload and statusCode', () => {
    const error = new AdminApiError({
      statusCode: 400,
      payload: { detail: 'Invalid input' },
      message: 'Bad request',
    });

    expect(error.statusCode).toBe(400);
    expect(error.payload).toEqual({ detail: 'Invalid input' });
    expect(error.message).toBe('Bad request');
  });
});
