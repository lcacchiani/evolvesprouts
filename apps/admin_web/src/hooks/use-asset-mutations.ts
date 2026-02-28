'use client';

import { useCallback, useState } from 'react';

import {
  createAdminAsset,
  deleteAdminAsset,
  updateAdminAsset,
  uploadFileToPresignedUrl,
} from '@/lib/assets-api';
import type { AdminAsset, CreatedAssetUpload, UpsertAdminAssetInput } from '@/types/assets';

import { toAdminAssetErrorMessage } from './admin-assets-errors';

type UploadState = 'idle' | 'uploading' | 'failed' | 'succeeded';

interface UseAssetMutationsOptions {
  applyCreatedAsset: (createdAsset: AdminAsset | null) => Promise<void>;
  applyUpdatedAsset: (assetId: string, updatedAsset: AdminAsset | null) => Promise<void>;
  applyDeletedAsset: (assetId: string) => void;
}

export interface UseAssetMutationsReturn {
  assetMutationError: string;
  isSavingAsset: boolean;
  isDeletingAssetId: string | null;
  uploadState: UploadState;
  uploadError: string;
  hasPendingUpload: boolean;
  createAssetEntry: (input: UpsertAdminAssetInput, file: File) => Promise<void>;
  updateAssetEntry: (assetId: string, input: UpsertAdminAssetInput) => Promise<void>;
  deleteAssetEntry: (assetId: string) => Promise<void>;
  retryPendingUpload: () => Promise<void>;
  resetMutationState: () => void;
}

export function useAssetMutations({
  applyCreatedAsset,
  applyUpdatedAsset,
  applyDeletedAsset,
}: UseAssetMutationsOptions): UseAssetMutationsReturn {
  const [assetMutationError, setAssetMutationError] = useState('');
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isDeletingAssetId, setIsDeletingAssetId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState('');
  const [pendingUpload, setPendingUpload] = useState<{
    upload: CreatedAssetUpload;
    file: File;
  } | null>(null);

  const resetMutationState = useCallback(() => {
    setAssetMutationError('');
    setUploadState('idle');
    setUploadError('');
    setPendingUpload(null);
  }, []);

  const createAssetEntry = useCallback(
    async (input: UpsertAdminAssetInput, file: File) => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadError('');
      setPendingUpload(null);

      try {
        const result = await createAdminAsset(input);
        const createdAsset = result.asset;
        const upload = result.upload;
        await applyCreatedAsset(createdAsset);

        if (!upload.uploadUrl) {
          setUploadState('failed');
          setUploadError('Upload URL was not returned by the API.');
          return;
        }

        setUploadState('uploading');
        setPendingUpload({ upload, file });
        try {
          await uploadFileToPresignedUrl({
            uploadUrl: upload.uploadUrl,
            uploadMethod: upload.uploadMethod,
            uploadHeaders: upload.uploadHeaders,
            file,
          });
          setUploadState('succeeded');
          setUploadError('');
          setPendingUpload(null);
        } catch (uploadFailure) {
          setUploadState('failed');
          setUploadError(toAdminAssetErrorMessage(uploadFailure, 'File upload failed.'));
        }
      } catch (error) {
        setAssetMutationError(toAdminAssetErrorMessage(error, 'Failed to create asset.'));
        throw error;
      } finally {
        setIsSavingAsset(false);
      }
    },
    [applyCreatedAsset]
  );

  const updateAssetEntry = useCallback(
    async (assetId: string, input: UpsertAdminAssetInput) => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadError('');
      setPendingUpload(null);

      try {
        const updatedAsset = await updateAdminAsset(assetId, input);
        await applyUpdatedAsset(assetId, updatedAsset);
      } catch (error) {
        setAssetMutationError(toAdminAssetErrorMessage(error, 'Failed to update asset.'));
        throw error;
      } finally {
        setIsSavingAsset(false);
      }
    },
    [applyUpdatedAsset]
  );

  const deleteAssetEntry = useCallback(
    async (assetId: string) => {
      setIsDeletingAssetId(assetId);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadError('');
      setPendingUpload(null);

      try {
        await deleteAdminAsset(assetId);
        applyDeletedAsset(assetId);
      } catch (error) {
        setAssetMutationError(toAdminAssetErrorMessage(error, 'Failed to delete asset.'));
        throw error;
      } finally {
        setIsDeletingAssetId(null);
      }
    },
    [applyDeletedAsset]
  );

  const retryPendingUpload = useCallback(async () => {
    if (!pendingUpload?.upload.uploadUrl) {
      return;
    }

    setUploadState('uploading');
    setUploadError('');
    try {
      await uploadFileToPresignedUrl({
        uploadUrl: pendingUpload.upload.uploadUrl,
        uploadMethod: pendingUpload.upload.uploadMethod,
        uploadHeaders: pendingUpload.upload.uploadHeaders,
        file: pendingUpload.file,
      });
      setUploadState('succeeded');
      setUploadError('');
      setPendingUpload(null);
    } catch (error) {
      setUploadState('failed');
      setUploadError(toAdminAssetErrorMessage(error, 'File upload failed.'));
    }
  }, [pendingUpload]);

  return {
    assetMutationError,
    isSavingAsset,
    isDeletingAssetId,
    uploadState,
    uploadError,
    hasPendingUpload: Boolean(pendingUpload?.upload.uploadUrl),
    createAssetEntry,
    updateAssetEntry,
    deleteAssetEntry,
    retryPendingUpload,
    resetMutationState,
  };
}
