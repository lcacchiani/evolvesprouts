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
  createAdminAsset,
  listAdminAssetGrants,
  listAdminAssets,
  uploadFileToPresignedUrl,
} from '@/lib/assets-api';

describe('assets-api', () => {
  beforeEach(() => {
    mockAdminApiRequest.mockReset();
    vi.mocked(fetch).mockReset();
  });

  it('lists assets using snake_case payload and query params', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'asset-1',
            title: 'Infant guide',
            description: null,
            asset_type: 'document',
            s3_key: 'assets/infant-guide.pdf',
            file_name: 'infant-guide.pdf',
            content_type: 'application/pdf',
            visibility: 'restricted',
            created_by: 'admin@example.com',
            created_at: '2026-02-27T00:00:00.000Z',
            updated_at: '2026-02-27T00:00:00.000Z',
          },
        ],
        next_cursor: 'cursor-1',
      },
    });

    const result = await listAdminAssets({
      query: '  infant ',
      visibility: 'restricted',
      assetType: 'document',
      cursor: 'abc',
      limit: 10,
    });

    expect(result.nextCursor).toBe('cursor-1');
    expect(result.items[0]).toMatchObject({
      id: 'asset-1',
      assetType: 'document',
      s3Key: 'assets/infant-guide.pdf',
      fileName: 'infant-guide.pdf',
      visibility: 'restricted',
    });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        endpointPath: expect.stringContaining('/v1/admin/assets?'),
      })
    );

    const request = mockAdminApiRequest.mock.calls[0][0];
    expect(request.endpointPath).toContain('query=infant');
    expect(request.endpointPath).toContain('visibility=restricted');
    expect(request.endpointPath).toContain('asset_type=document');
    expect(request.endpointPath).toContain('cursor=abc');
    expect(request.endpointPath).toContain('limit=10');
  });

  it('creates asset with snake_case request body and parses upload details', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      data: {
        asset: {
          id: 'asset-2',
          title: 'Nutrition PDF',
          description: null,
          asset_type: 'document',
          s3_key: 'assets/nutrition.pdf',
          file_name: 'nutrition.pdf',
          content_type: 'application/pdf',
          visibility: 'public',
          created_by: null,
          created_at: null,
          updated_at: null,
        },
        upload_url: 'https://uploads.example.com/asset-2',
        upload_method: 'PUT',
        upload_headers: {
          'x-amz-acl': 'private',
        },
        expires_at: '2026-02-28T00:00:00.000Z',
      },
    });

    const result = await createAdminAsset({
      title: '  Nutrition PDF  ',
      description: '  ',
      assetType: 'document',
      fileName: ' nutrition.pdf ',
      contentType: ' application/pdf ',
      visibility: 'public',
    });

    expect(mockAdminApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        endpointPath: '/v1/admin/assets',
        body: {
          title: 'Nutrition PDF',
          description: null,
          asset_type: 'document',
          file_name: 'nutrition.pdf',
          content_type: 'application/pdf',
          visibility: 'public',
        },
      })
    );

    expect(result.asset).toMatchObject({
      id: 'asset-2',
      title: 'Nutrition PDF',
      assetType: 'document',
    });
    expect(result.upload).toEqual({
      uploadUrl: 'https://uploads.example.com/asset-2',
      uploadMethod: 'PUT',
      uploadHeaders: { 'x-amz-acl': 'private' },
      expiresAt: '2026-02-28T00:00:00.000Z',
    });
  });

  it('parses grants list payload', async () => {
    mockAdminApiRequest.mockResolvedValueOnce({
      items: [
        {
          id: 'grant-1',
          asset_id: 'asset-1',
          grant_type: 'organization',
          grantee_id: 'org-1',
          granted_by: 'admin@example.com',
          created_at: '2026-02-27T12:00:00.000Z',
        },
      ],
    });

    const grants = await listAdminAssetGrants('asset-1');
    expect(grants).toEqual([
      {
        id: 'grant-1',
        assetId: 'asset-1',
        grantType: 'organization',
        granteeId: 'org-1',
        grantedBy: 'admin@example.com',
        createdAt: '2026-02-27T12:00:00.000Z',
      },
    ]);
  });

  it('uploads file to presigned URL and sets Content-Type fallback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    const file = new File(['pdf-content'], 'guide.pdf', { type: 'application/pdf' });
    await uploadFileToPresignedUrl({
      uploadUrl: 'https://uploads.example.com/asset-1',
      uploadMethod: 'PUT',
      uploadHeaders: {},
      file,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://uploads.example.com/asset-1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/pdf',
        }),
        body: file,
      })
    );
  });

  it('throws upload error when presigned upload fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const file = new File(['pdf-content'], 'guide.pdf', { type: 'application/pdf' });
    await expect(
      uploadFileToPresignedUrl({
        uploadUrl: 'https://uploads.example.com/asset-1',
        file,
      })
    ).rejects.toThrow('Upload failed with status 500.');
  });
});
