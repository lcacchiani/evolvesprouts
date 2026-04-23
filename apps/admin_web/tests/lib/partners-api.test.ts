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
  addPartnerMember,
  createAdminPartner,
  deleteAdminPartner,
  listAdminPartners,
  patchPartnerMember,
  removePartnerMember,
  updateAdminPartner,
} from '@/lib/partners-api';

const orgPayload = {
  id: 'partner-1',
  name: 'Alpha Partner',
  organization_type: 'company',
  relationship_type: 'partner',
  slug: 'alpha',
  website: null,
  location_id: null,
  location_summary: null,
  active: true,
  archived_at: null,
  created_at: null,
  updated_at: null,
  tag_ids: [],
  tags: [],
  members: [],
};

describe('partners-api', () => {
  beforeEach(() => {
    mockAdminApiRequest.mockReset();
  });

  it('lists partners with relationship_type=partner', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      items: [orgPayload],
      next_cursor: 'c1',
      total_count: 1,
    });

    const result = await listAdminPartners({
      query: 'alpha',
      active: 'true',
      cursor: 'abc',
      limit: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.nextCursor).toBe('c1');
    expect(result.items[0]).toMatchObject({ id: 'partner-1', relationship_type: 'partner' });

    const request = mockAdminApiRequest.mock.calls[0][0];
    expect(request.method).toBe('GET');
    expect(request.endpointPath).toContain('/v1/admin/organizations?');
    expect(request.endpointPath).toContain('relationship_type=partner');
    expect(request.endpointPath).toContain('query=alpha');
    expect(request.endpointPath).toContain('active=true');
    expect(request.endpointPath).toContain('cursor=abc');
    expect(request.endpointPath).toContain('limit=10');
  });

  it('creates a partner', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({ organization: orgPayload });

    await createAdminPartner({
      name: 'Beta',
      organization_type: 'ngo',
      relationship_type: 'partner',
      slug: 'beta',
      website: null,
      location_id: null,
      tag_ids: [],
    });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/organizations',
        method: 'POST',
        body: expect.objectContaining({
          name: 'Beta',
          relationship_type: 'partner',
        }),
      })
    );
  });

  it('updates and deletes a partner', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({ organization: orgPayload });
    await updateAdminPartner('partner-1', { name: 'Alpha Updated' });
    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/organizations/partner-1',
        method: 'PATCH',
      })
    );

    mockAdminApiRequest.mockResolvedValueOnce(undefined);
    await deleteAdminPartner('partner-1');
    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/organizations/partner-1',
        method: 'DELETE',
        expectedSuccessStatuses: [204],
      })
    );
  });

  it('member wrappers call members routes', async () => {
    mockAdminApiRequest.mockResolvedValue({ organization: orgPayload });
    await addPartnerMember('partner-1', { contact_id: 'c1', is_primary_contact: false });
    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/organizations/partner-1/members',
        method: 'POST',
      })
    );

    await removePartnerMember('partner-1', 'm1');
    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/organizations/partner-1/members/m1',
        method: 'DELETE',
      })
    );

    await patchPartnerMember('partner-1', 'm1', { is_primary_contact: true });
    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/organizations/partner-1/members/m1',
        method: 'PATCH',
      })
    );
  });
});
