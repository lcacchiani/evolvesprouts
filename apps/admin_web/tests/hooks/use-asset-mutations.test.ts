import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateAdminAsset,
  mockInitAdminAssetContentReplace,
  mockCompleteAdminAssetContentReplace,
  mockUploadFileToPresignedUrl,
  mockUpdateAdminAsset,
  mockDeleteAdminAsset,
} = vi.hoisted(() => ({
  mockCreateAdminAsset: vi.fn(),
  mockInitAdminAssetContentReplace: vi.fn(),
  mockCompleteAdminAssetContentReplace: vi.fn(),
  mockUploadFileToPresignedUrl: vi.fn(),
  mockUpdateAdminAsset: vi.fn(),
  mockDeleteAdminAsset: vi.fn(),
}));

vi.mock('@/lib/assets-api', () => ({
  createAdminAsset: mockCreateAdminAsset,
  initAdminAssetContentReplace: mockInitAdminAssetContentReplace,
  completeAdminAssetContentReplace: mockCompleteAdminAssetContentReplace,
  uploadFileToPresignedUrl: mockUploadFileToPresignedUrl,
  updateAdminAsset: mockUpdateAdminAsset,
  deleteAdminAsset: mockDeleteAdminAsset,
}));

import { useAssetMutations } from '@/hooks/use-asset-mutations';

describe('useAssetMutations', () => {
  const applyCreatedAsset = vi.fn();
  const applyUpdatedAsset = vi.fn();
  const applyDeletedAsset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-inits replace upload when retrying PUT and presign is expired', async () => {
    const expiredIso = new Date(Date.now() - 60_000).toISOString();
    const fresh = {
      pendingS3Key: 'assets/asset-1/refreshed-key.pdf',
      uploadUrl: 'https://fresh.example/put',
      uploadMethod: 'PUT',
      uploadHeaders: {},
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
    mockInitAdminAssetContentReplace
      .mockResolvedValueOnce({
        pendingS3Key: 'assets/asset-1/old-key.pdf',
        uploadUrl: 'https://old.example/put',
        uploadMethod: 'PUT',
        uploadHeaders: {},
        expiresAt: expiredIso,
      })
      .mockResolvedValueOnce(fresh);
    mockUploadFileToPresignedUrl.mockRejectedValueOnce(new Error('upload failed'));
    mockUploadFileToPresignedUrl.mockResolvedValueOnce(undefined);
    mockCompleteAdminAssetContentReplace.mockResolvedValueOnce({ id: 'asset-1' });

    const { result } = renderHook(() =>
      useAssetMutations({
        applyCreatedAsset,
        applyUpdatedAsset,
        applyDeletedAsset,
      })
    );

    await act(async () => {
      await result.current.replaceAssetFileEntry(
        'asset-1',
        new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }),
        'application/pdf'
      );
    });

    expect(result.current.uploadState).toBe('failed');
    expect(mockInitAdminAssetContentReplace).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retryPendingUpload();
    });

    expect(mockInitAdminAssetContentReplace).toHaveBeenCalledTimes(2);
    expect(mockUploadFileToPresignedUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({ uploadUrl: 'https://fresh.example/put' })
    );
    expect(mockCompleteAdminAssetContentReplace).toHaveBeenCalledWith(
      'asset-1',
      expect.objectContaining({ pendingS3Key: 'assets/asset-1/refreshed-key.pdf' })
    );
  });

  it('retries complete-only path without re-init', async () => {
    mockInitAdminAssetContentReplace.mockResolvedValueOnce({
      pendingS3Key: 'assets/asset-1/k1.pdf',
      uploadUrl: 'https://u.example/1',
      uploadMethod: 'PUT',
      uploadHeaders: {},
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    mockUploadFileToPresignedUrl.mockResolvedValueOnce(undefined);
    mockCompleteAdminAssetContentReplace
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ id: 'asset-1' });

    const { result } = renderHook(() =>
      useAssetMutations({
        applyCreatedAsset,
        applyUpdatedAsset,
        applyDeletedAsset,
      })
    );

    await act(async () => {
      await result.current.replaceAssetFileEntry(
        'asset-1',
        new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }),
        'application/pdf'
      );
    });

    expect(result.current.uploadState).toBe('failed');
    expect(mockInitAdminAssetContentReplace).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retryPendingUpload();
    });

    expect(mockInitAdminAssetContentReplace).toHaveBeenCalledTimes(1);
    expect(mockCompleteAdminAssetContentReplace).toHaveBeenCalledTimes(2);
  });
});
