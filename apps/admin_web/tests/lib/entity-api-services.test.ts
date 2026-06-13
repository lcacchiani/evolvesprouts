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

import { listAdminContactServices } from '@/lib/entity-api';

describe('entity-api services', () => {
  beforeEach(() => {
    mockAdminApiRequest.mockReset();
  });

  it('listAdminContactServices maps item labels to string array', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      items: [{ label: 'Event: June Weekend' }, { label: 42 }, { label: 'Training course: A' }],
    });

    const labels = await listAdminContactServices('contact-1');

    expect(labels).toEqual(['Event: June Weekend', 'Training course: A']);
    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointPath: '/v1/admin/contacts/contact-1/services',
        method: 'GET',
      })
    );
  });
});
