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

import { createServiceCoverImageUpload, listServices } from '@/lib/services-api';

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
});
