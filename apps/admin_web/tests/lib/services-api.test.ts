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
  createServiceCoverImageUpload,
  listDiscountCodes,
  listAllVenueAndPartnerLocations,
  listLocations,
  listServices,
} from '@/lib/services-api';

describe('services-api', () => {
  beforeEach(() => {
    mockAdminApiRequest.mockReset();
  });

  it('lists services and maps snake_case payload', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'service-1',
            service_type: 'training_course',
            title: 'Sleep workshop',
            description: null,
            cover_image_s3_key: null,
            delivery_mode: 'online',
            status: 'draft',
            created_by: 'admin-1',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
            training_details: {
              pricing_unit: 'per_family',
              default_price: '120.50',
              default_currency: 'HKD',
            },
          },
        ],
        next_cursor: 'cursor-1',
        total_count: 1,
      },
    });

    const result = await listServices({
      serviceType: 'training_course',
      status: 'draft',
      search: 'sleep',
      cursor: 'abc',
      limit: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.nextCursor).toBe('cursor-1');
    expect(result.items[0]).toMatchObject({
      id: 'service-1',
      serviceType: 'training_course',
      deliveryMode: 'online',
      status: 'draft',
      trainingDetails: {
        pricingUnit: 'per_family',
        defaultPrice: '120.50',
        defaultCurrency: 'HKD',
      },
    });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        endpointPath: expect.stringContaining('/v1/admin/services?'),
      })
    );
    const request = mockAdminApiRequest.mock.calls[0][0];
    expect(request.endpointPath).toContain('service_type=training_course');
    expect(request.endpointPath).toContain('status=draft');
    expect(request.endpointPath).toContain('search=sleep');
    expect(request.endpointPath).toContain('cursor=abc');
    expect(request.endpointPath).toContain('limit=10');
  });

  it('creates cover-image upload URL and maps response', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      data: {
        upload_url: 'https://uploads.example.com/path',
        upload_method: 'PUT',
        upload_headers: {
          'Content-Type': 'image/jpeg',
        },
        s3_key: 'media/services/service-1/cover/file.jpg',
        expires_at: '2026-03-02T00:00:00.000Z',
        service: {
          id: 'service-1',
          cover_image_s3_key: 'media/services/service-1/cover/file.jpg',
        },
      },
    });

    const result = await createServiceCoverImageUpload('service-1', {
      file_name: 'cover.jpg',
      content_type: 'image/jpeg',
    });

    expect(result.uploadUrl).toBe('https://uploads.example.com/path');
    expect(result.uploadMethod).toBe('PUT');
    expect(result.s3Key).toContain('media/services/service-1/cover/');
    expect(result.service.id).toBe('service-1');

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        endpointPath: '/v1/admin/services/service-1/cover-image',
        body: {
          file_name: 'cover.jpg',
          content_type: 'image/jpeg',
        },
      })
    );
  });

  it('normalizes discount_type from listDiscountCodes (string casing and non-string)', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'dc-1',
            code: 'A',
            description: null,
            discount_type: 'REFERRAL',
            discount_value: '0',
            currency: 'HKD',
            valid_from: null,
            valid_until: null,
            service_id: null,
            instance_id: null,
            max_uses: null,
            current_uses: 0,
            active: true,
            created_by: 'u',
            created_at: null,
            updated_at: null,
          },
          {
            id: 'dc-2',
            code: 'B',
            description: null,
            discount_type: 'unknown_kind',
            discount_value: '10',
            currency: 'HKD',
            valid_from: null,
            valid_until: null,
            service_id: null,
            instance_id: null,
            max_uses: null,
            current_uses: 0,
            active: true,
            created_by: 'u',
            created_at: null,
            updated_at: null,
          },
        ],
        next_cursor: null,
        total_count: 2,
      },
    });

    const result = await listDiscountCodes({ limit: 50 });

    expect(result.items[0].discountType).toBe('referral');
    expect(result.items[1].discountType).toBe('percentage');
  });

  it('parses venue coordinates from number or string response', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'loc-1',
            name: 'A',
            area_id: '00000000-0000-0000-0000-000000000001',
            address: '1 Rd',
            lat: 22.3193,
            lng: 114.1694,
            created_at: null,
            updated_at: null,
          },
          {
            id: 'loc-2',
            name: 'B',
            area_id: '00000000-0000-0000-0000-000000000002',
            address: '2 Rd',
            lat: '33.3',
            lng: '55.5',
            created_at: null,
            updated_at: null,
          },
        ],
        next_cursor: null,
        total_count: 2,
      },
    });

    const result = await listLocations({ limit: 50 });

    expect(result.items[0].lat).toBe(22.3193);
    expect(result.items[0].lng).toBe(114.1694);
    expect(result.items[1].lat).toBe(33.3);
    expect(result.items[1].lng).toBe(55.5);
  });

  it('adds exclude_addresses when listLocations requests family/org address exclusion', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      data: {
        items: [],
        next_cursor: null,
        total_count: 0,
      },
    });

    await listLocations({ limit: 50, excludeAddresses: true });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        endpointPath: '/v1/admin/locations?limit=50&exclude_addresses=true',
      })
    );
  });

  it('listAllVenueAndPartnerLocations merges exclude_addresses pages with partner-labelled locations', async () => {
    const venueRow = {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Hall',
      area_id: '00000000-0000-0000-0000-000000000001',
      address: '2 Rd',
      lat: null,
      lng: null,
      created_at: null,
      updated_at: null,
      locked_from_partner_org: false,
      partner_organization_labels: [],
    };
    const partnerOnlyRow = {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Partner HQ',
      area_id: '00000000-0000-0000-0000-000000000001',
      address: '3 Rd',
      lat: null,
      lng: null,
      created_at: null,
      updated_at: null,
      locked_from_partner_org: true,
      partner_organization_labels: ['Acme Partner'],
    };

    mockAdminApiRequest
      .mockResolvedValueOnce({
        data: {
          items: [venueRow],
          next_cursor: null,
          total_count: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [partnerOnlyRow, venueRow],
          next_cursor: null,
          total_count: 2,
        },
      });

    const merged = await listAllVenueAndPartnerLocations();

    expect(mockAdminApiRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        endpointPath: '/v1/admin/locations?limit=100&exclude_addresses=true',
      })
    );
    expect(mockAdminApiRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        endpointPath: '/v1/admin/locations?limit=100',
      })
    );
    expect(merged.map((l) => l.id)).toEqual([
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
    ]);
  });
});
