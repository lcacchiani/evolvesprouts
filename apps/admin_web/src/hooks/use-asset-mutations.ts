'use client';

import { useCallback, useState } from 'react';

import {
  completeAdminAssetContentReplace,
  createAdminAsset,
  deleteAdminAsset,
  initAdminAssetContentReplace,
  updateAdminAsset,
  uploadFileToPresignedUrl,
} from '@/lib/assets-api';
import type {
  AdminAsset,
  CreatedAssetUpload,
  InitAdminAssetContentReplaceUpload,
  UpdateAdminAssetPatchInput,
  UpsertAdminAssetInput,
} from '@/types/assets';

import { toErrorMessage } from './hook-errors';

type UploadState = 'idle' | 'uploading' | 'failed' | 'succeeded';

type PendingAssetFileMutation =
  | {
      kind: 'create';
      stage: 'upload';
      upload: CreatedAssetUpload;
      file: File;
    }
  | {
      kind: 'replace';
      stage: 'upload';
      assetId: string;
      fileName: string;
      contentType: string | null;
      upload: InitAdminAssetContentReplaceUpload;
      file: File;
    }
  | {
      kind: 'replace';
      stage: 'complete';
      assetId: string;
      pendingS3Key: string;
      fileName: string;
      contentType: string | null;
    };

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
  replaceAssetFileEntry: (
    assetId: string,
    file: File,
    contentType: string | null
  ) => Promise<void>;
  updateAssetEntry: (assetId: string, input: UpdateAdminAssetPatchInput) => Promise<void>;
  deleteAssetEntry: (assetId: string) => Promise<void>;
  retryPendingUpload: () => Promise<void>;
  resetMutationState: () => void;
  /** Increments when a file replace (init + upload + complete) succeeds; use to remount editors. */
  replaceSuccessNonce: number;
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
  const [pendingUpload, setPendingUpload] = useState<PendingAssetFileMutation | null>(null);
  const [replaceSuccessNonce, setReplaceSuccessNonce] = useState(0);

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
        setPendingUpload({ kind: 'create', stage: 'upload', upload, file });
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
          setUploadError(toErrorMessage(uploadFailure, 'File upload failed.'));
        }
      } catch (error) {
        setAssetMutationError(toErrorMessage(error, 'Failed to create asset.'));
        throw error;
      } finally {
        setIsSavingAsset(false);
      }
    },
    [applyCreatedAsset]
  );

  const replaceAssetFileEntry = useCallback(
    async (assetId: string, file: File, contentType: string | null) => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadError('');
      setPendingUpload(null);

      try {
        const initUpload = await initAdminAssetContentReplace(assetId, {
          fileName: file.name,
          contentType: contentType ?? undefined,
        });
        if (!initUpload.uploadUrl) {
          setUploadState('failed');
          setUploadError('Upload URL was not returned by the API.');
          return;
        }

        setUploadState('uploading');
        setPendingUpload({
          kind: 'replace',
          stage: 'upload',
          assetId,
          fileName: file.name,
          contentType,
          upload: initUpload,
          file,
        });
        try {
          await uploadFileToPresignedUrl({
            uploadUrl: initUpload.uploadUrl,
            uploadMethod: initUpload.uploadMethod,
            uploadHeaders: initUpload.uploadHeaders,
            file,
          });
        } catch (uploadFailure) {
          setUploadState('failed');
          setUploadError(toErrorMessage(uploadFailure, 'File upload failed.'));
          return;
        }

        try {
          const updatedAsset = await completeAdminAssetContentReplace(assetId, {
            pendingS3Key: initUpload.pendingS3Key,
            fileName: file.name,
            contentType,
          });
          await applyUpdatedAsset(assetId, updatedAsset);
          setUploadState('succeeded');
          setUploadError('');
          setPendingUpload(null);
          setReplaceSuccessNonce((n) => n + 1);
        } catch (completeFailure) {
          setUploadState('failed');
          setUploadError(toErrorMessage(completeFailure, 'Failed to finalize file replacement.'));
          setPendingUpload({
            kind: 'replace',
            stage: 'complete',
            assetId,
            pendingS3Key: initUpload.pendingS3Key,
            fileName: file.name,
            contentType,
          });
        }
      } catch (error) {
        setAssetMutationError(toErrorMessage(error, 'Failed to replace asset file.'));
        throw error;
      } finally {
        setIsSavingAsset(false);
      }
    },
    [applyUpdatedAsset]
  );

  const updateAssetEntry = useCallback(
    async (assetId: string, input: UpdateAdminAssetPatchInput) => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadError('');
      setPendingUpload(null);

      try {
        const updatedAsset = await updateAdminAsset(assetId, input);
        await applyUpdatedAsset(assetId, updatedAsset);
      } catch (error) {
        setAssetMutationError(toErrorMessage(error, 'Failed to update asset.'));
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
        setAssetMutationError(toErrorMessage(error, 'Failed to delete asset.'));
        throw error;
      } finally {
        setIsDeletingAssetId(null);
      }
    },
    [applyDeletedAsset]
  );

  const retryPendingUpload = useCallback(async () => {
    if (!pendingUpload) {
      return;
    }

    if (pendingUpload.kind === 'replace' && pendingUpload.stage === 'complete') {
      setUploadState('uploading');
      setUploadError('');
      try {
        const updatedAsset = await completeAdminAssetContentReplace(pendingUpload.assetId, {
          pendingS3Key: pendingUpload.pendingS3Key,
          fileName: pendingUpload.fileName,
          contentType: pendingUpload.contentType,
        });
        await applyUpdatedAsset(pendingUpload.assetId, updatedAsset);
        setUploadState('succeeded');
        setUploadError('');
        setPendingUpload(null);
        setReplaceSuccessNonce((n) => n + 1);
      } catch (error) {
        setUploadState('failed');
        setUploadError(toErrorMessage(error, 'Failed to finalize file replacement.'));
      }
      return;
    }

    if (pendingUpload.kind === 'create') {
      const { upload, file } = pendingUpload;
      if (!upload.uploadUrl) {
        return;
      }

      setUploadState('uploading');
      setUploadError('');
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
      } catch (error) {
        setUploadState('failed');
        setUploadError(toErrorMessage(error, 'File upload failed.'));
      }
      return;
    }

    const { upload, file } = pendingUpload;
    if (!upload.uploadUrl) {
      return;
    }

    setUploadState('uploading');
    setUploadError('');
    try {
      await uploadFileToPresignedUrl({
        uploadUrl: upload.uploadUrl,
        uploadMethod: upload.uploadMethod,
        uploadHeaders: upload.uploadHeaders,
        file,
      });
      try {
        const updatedAsset = await completeAdminAssetContentReplace(pendingUpload.assetId, {
          pendingS3Key: upload.pendingS3Key,
          fileName: pendingUpload.fileName,
          contentType: pendingUpload.contentType,
        });
        await applyUpdatedAsset(pendingUpload.assetId, updatedAsset);
        setUploadState('succeeded');
        setUploadError('');
        setPendingUpload(null);
        setReplaceSuccessNonce((n) => n + 1);
      } catch (completeFailure) {
        setUploadState('failed');
        setUploadError(
          toErrorMessage(completeFailure, 'Failed to finalize file replacement.')
        );
        setPendingUpload({
          kind: 'replace',
          stage: 'complete',
          assetId: pendingUpload.assetId,
          pendingS3Key: upload.pendingS3Key,
          fileName: pendingUpload.fileName,
          contentType: pendingUpload.contentType,
        });
      }
    } catch (error) {
      setUploadState('failed');
      setUploadError(toErrorMessage(error, 'File upload failed.'));
    }
  }, [applyUpdatedAsset, pendingUpload]);

  return {
    assetMutationError,
    isSavingAsset,
    isDeletingAssetId,
    uploadState,
    uploadError,
    hasPendingUpload: Boolean(
      pendingUpload &&
        (pendingUpload.kind === 'replace' && pendingUpload.stage === 'complete'
          ? true
          : pendingUpload.upload.uploadUrl)
    ),
    createAssetEntry,
    replaceAssetFileEntry,
    updateAssetEntry,
    deleteAssetEntry,
    retryPendingUpload,
    resetMutationState,
    replaceSuccessNonce,
  };
}
