import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAdminApiRequest } = vi.hoisted(() => ({
  mockAdminApiRequest: vi.fn(),
}));

vi.mock('@/lib/api-admin-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-admin-client')>(
    '@/lib/api-admin-client'
  );
  return {
    ...actual,
    adminApiRequest: mockAdminApiRequest,
  };
});

import {
  createAdminTag,
  deleteOrArchiveAdminTag,
  listAdminTags,
  updateAdminTag,
} from '@/lib/tags-api';

describe('tags-api', () => {
  beforeEach(() => {
    mockAdminApiRequest.mockReset();
  });

  it('lists tags with optional include_archived', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      items: [
        {
          id: 't1',
          name: 'Alpha',
          color: '#112233',
          description: null,
          archived_at: null,
          usage_count: 0,
        },
      ],
    });

    const rows = await listAdminTags({ includeArchived: true });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('t1');
    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/tags?include_archived=true',
        method: 'GET',
      })
    );
  });

  it('deleteOrArchiveAdminTag treats empty body as hard delete', async () => {
    mockAdminApiRequest.mockResolvedValueOnce(null);

    const outcome = await deleteOrArchiveAdminTag('t1');

    expect(outcome).toEqual({ status: 204 });
  });

  it('deleteOrArchiveAdminTag parses archive response', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      tag: {
        id: 't1',
        name: 'Alpha',
        color: null,
        description: null,
        archived_at: '2026-01-01T00:00:00.000Z',
        usage_count: 2,
      },
    });

    const outcome = await deleteOrArchiveAdminTag('t1');

    expect(outcome.status).toBe(200);
    if (outcome.status === 200) {
      expect(outcome.tag.archived_at).toBe('2026-01-01T00:00:00.000Z');
    }
  });

  it('createAdminTag unwraps tag payload', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      tag: {
        id: 'new',
        name: 'Beta',
        color: null,
        description: null,
        archived_at: null,
        usage_count: 0,
      },
    });

    const row = await createAdminTag({ name: 'Beta' });

    expect(row?.id).toBe('new');
  });

  it('updateAdminTag sends PATCH', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      tag: {
        id: 't1',
        name: 'Beta',
        color: null,
        description: null,
        archived_at: null,
        usage_count: 0,
      },
    });

    await updateAdminTag('t1', { name: 'Beta' });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/tags/t1',
        method: 'PATCH',
        body: { name: 'Beta' },
      })
    );
  });
});
