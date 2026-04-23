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

const tagRow = {
  id: 't1',
  name: 'Alpha',
  color: '#112233',
  description: null,
  archived_at: null,
  usage_count: 0,
  is_system: false,
};

describe('tags-api', () => {
  beforeEach(() => {
    mockAdminApiRequest.mockReset();
  });

  it('lists active tags by default', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({ items: [tagRow] });

    const rows = await listAdminTags();

    expect(rows).toHaveLength(1);
    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/tags',
        method: 'GET',
      })
    );
  });

  it('lists all tags when filter is all', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({ items: [tagRow] });

    await listAdminTags({ filter: 'all' });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/tags?include_archived=true',
        method: 'GET',
      })
    );
  });

  it('lists archived-only when filter is archived', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({ items: [tagRow] });

    await listAdminTags({ filter: 'archived' });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/tags?archived_only=true',
        method: 'GET',
      })
    );
  });

  it('deleteOrArchiveAdminTag parses hard delete response', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      deleted: true,
      usage_count: 0,
    });

    const outcome = await deleteOrArchiveAdminTag('t1');

    expect(outcome).toEqual({ deleted: true, usage_count: 0 });
  });

  it('deleteOrArchiveAdminTag parses archive response', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      deleted: false,
      usage_count: 2,
      tag: {
        ...tagRow,
        archived_at: '2026-01-01T00:00:00.000Z',
        usage_count: 2,
      },
    });

    const outcome = await deleteOrArchiveAdminTag('t1');

    expect(outcome.deleted).toBe(false);
    expect(outcome.usage_count).toBe(2);
    expect(outcome.tag?.archived_at).toBe('2026-01-01T00:00:00.000Z');
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
        is_system: false,
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
        is_system: false,
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
