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

import { createAdminVendor, listAdminVendors, updateAdminVendor } from '@/lib/vendors-api';

describe('vendors-api', () => {
  beforeEach(() => {
    mockAdminApiRequest.mockReset();
  });

  it('lists vendors with query params', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      items: [
        {
          id: 'vendor-1',
          name: 'Acme Vendor',
          website: 'https://vendor.example.com',
          active: true,
          archived_at: null,
          created_at: null,
          updated_at: null,
        },
      ],
      next_cursor: 'cursor-1',
      total_count: 1,
    });

    const result = await listAdminVendors({
      query: 'acme',
      active: 'true',
      cursor: 'abc',
      limit: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.nextCursor).toBe('cursor-1');
    expect(result.items[0]).toMatchObject({ id: 'vendor-1', name: 'Acme Vendor' });

    const request = mockAdminApiRequest.mock.calls[0][0];
    expect(request.method).toBe('GET');
    expect(request.endpointPath).toContain('/v1/admin/vendors?');
    expect(request.endpointPath).toContain('query=acme');
    expect(request.endpointPath).toContain('active=true');
    expect(request.endpointPath).toContain('cursor=abc');
    expect(request.endpointPath).toContain('limit=10');
  });

  it('creates a vendor', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      vendor: {
        id: 'vendor-2',
        name: 'Acme Vendor',
        website: null,
        active: true,
        archived_at: null,
        created_at: null,
        updated_at: null,
      },
    });

    await createAdminVendor({
      name: 'Acme Vendor',
      website: null,
      active: true,
    });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/vendors',
        method: 'POST',
        body: {
          name: 'Acme Vendor',
          website: null,
          active: true,
        },
      })
    );
  });

  it('updates a vendor', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      vendor: {
        id: 'vendor-2',
        name: 'Acme Vendor Updated',
        website: null,
        active: true,
        archived_at: null,
        created_at: null,
        updated_at: null,
      },
    });

    await updateAdminVendor('vendor-2', {
      name: 'Acme Vendor Updated',
      website: null,
      active: true,
    });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/vendors/vendor-2',
        method: 'PATCH',
      })
    );
  });
});
