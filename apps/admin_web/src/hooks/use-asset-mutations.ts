'use client';

import { useCallback, useRef, useState } from 'react';

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

/** When uploadState is uploading, distinguishes presigned PUT vs finalize (complete) step. */
export type AssetUploadPhase = 'idle' | 'put' | 'complete';

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
  uploadPhase: AssetUploadPhase;
  uploadError: string;
  hasPendingUpload: boolean;
  createAssetEntry: (input: UpsertAdminAssetInput, file: File) => Promise<void>;
  replaceAssetFileEntry: (
    assetId: string,
    file: File,
    contentType: string | null
  ) => Promise<boolean>;
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
  const [uploadPhase, setUploadPhase] = useState<AssetUploadPhase>('idle');
  const [uploadError, setUploadError] = useState('');
  const [pendingUpload, setPendingUpload] = useState<PendingAssetFileMutation | null>(null);
  const pendingUploadRef = useRef<PendingAssetFileMutation | null>(null);
  const [replaceSuccessNonce, setReplaceSuccessNonce] = useState(0);

  const setPendingUploadState = useCallback((next: PendingAssetFileMutation | null) => {
    pendingUploadRef.current = next;
    setPendingUpload(next);
  }, []);

  const resetMutationState = useCallback(() => {
    setAssetMutationError('');
    setUploadState('idle');
    setUploadPhase('idle');
    setUploadError('');
    setPendingUploadState(null);
  }, [setPendingUploadState]);

  const createAssetEntry = useCallback(
    async (input: UpsertAdminAssetInput, file: File) => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadPhase('idle');
      setUploadError('');
      setPendingUploadState(null);

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

        setUploadPhase('put');
        setUploadState('uploading');
        setPendingUploadState({ kind: 'create', stage: 'upload', upload, file });
        try {
          await uploadFileToPresignedUrl({
            uploadUrl: upload.uploadUrl,
            uploadMethod: upload.uploadMethod,
            uploadHeaders: upload.uploadHeaders,
            file,
          });
          setUploadState('succeeded');
          setUploadPhase('idle');
          setUploadError('');
          setPendingUploadState(null);
        } catch (uploadFailure) {
          setUploadState('failed');
          setUploadPhase('idle');
          setUploadError(toErrorMessage(uploadFailure, 'File upload failed.'));
        }
      } catch (error) {
        setAssetMutationError(toErrorMessage(error, 'Failed to create asset.'));
        throw error;
      } finally {
        setIsSavingAsset(false);
      }
    },
    [applyCreatedAsset, setPendingUploadState]
  );

  const replaceAssetFileEntry = useCallback(
    async (assetId: string, file: File, contentType: string | null): Promise<boolean> => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadPhase('idle');
      setUploadError('');
      setPendingUploadState(null);

      try {
        const initUpload = await initAdminAssetContentReplace(assetId, {
          fileName: file.name,
          contentType: contentType ?? undefined,
        });
        if (!initUpload.uploadUrl) {
          setUploadState('failed');
          setUploadPhase('idle');
          setUploadError('Upload URL was not returned by the API.');
          return false;
        }

        setUploadPhase('put');
        setUploadState('uploading');
        setPendingUploadState({
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
          setUploadPhase('idle');
          setUploadError(toErrorMessage(uploadFailure, 'File upload failed.'));
          return false;
        }

        try {
          setUploadPhase('complete');
          const updatedAsset = await completeAdminAssetContentReplace(assetId, {
            pendingS3Key: initUpload.pendingS3Key,
            fileName: file.name,
            contentType,
          });
          await applyUpdatedAsset(assetId, updatedAsset);
          setUploadState('succeeded');
          setUploadPhase('idle');
          setUploadError('');
          setPendingUploadState(null);
          setReplaceSuccessNonce((n) => n + 1);
          return true;
        } catch (completeFailure) {
          setUploadState('failed');
          setUploadPhase('idle');
          setUploadError(toErrorMessage(completeFailure, 'Failed to finalize file replacement.'));
          setPendingUploadState({
            kind: 'replace',
            stage: 'complete',
            assetId,
            pendingS3Key: initUpload.pendingS3Key,
            fileName: file.name,
            contentType,
          });
          return false;
        }
      } catch (error) {
        setAssetMutationError(toErrorMessage(error, 'Failed to replace asset file.'));
        setUploadPhase('idle');
        return false;
      } finally {
        setIsSavingAsset(false);
      }
    },
    [applyUpdatedAsset, setPendingUploadState]
  );

  const updateAssetEntry = useCallback(
    async (assetId: string, input: UpdateAdminAssetPatchInput) => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadPhase('idle');
      setUploadError('');
      setPendingUploadState(null);

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
    [applyUpdatedAsset, setPendingUploadState]
  );

  const deleteAssetEntry = useCallback(
    async (assetId: string) => {
      setIsDeletingAssetId(assetId);
      setAssetMutationError('');
      setUploadState('idle');
      setUploadPhase('idle');
      setUploadError('');
      setPendingUploadState(null);

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
    [applyDeletedAsset, setPendingUploadState]
  );

  const retryPendingUpload = useCallback(async () => {
    const pending = pendingUploadRef.current;
    if (!pending) {
      return;
    }

    if (pending.kind === 'replace' && pending.stage === 'complete') {
      setUploadPhase('complete');
      setUploadState('uploading');
      setUploadError('');
      try {
        const updatedAsset = await completeAdminAssetContentReplace(pending.assetId, {
          pendingS3Key: pending.pendingS3Key,
          fileName: pending.fileName,
          contentType: pending.contentType,
        });
        await applyUpdatedAsset(pending.assetId, updatedAsset);
        setUploadState('succeeded');
        setUploadPhase('idle');
        setUploadError('');
        setPendingUploadState(null);
        setReplaceSuccessNonce((n) => n + 1);
      } catch (error) {
        setUploadState('failed');
        setUploadPhase('idle');
        setUploadError(toErrorMessage(error, 'Failed to finalize file replacement.'));
      }
      return;
    }

    if (pending.kind === 'create') {
      const { upload, file } = pending;
      if (!upload.uploadUrl) {
        return;
      }

      setUploadPhase('put');
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
        setUploadPhase('idle');
        setUploadError('');
        setPendingUploadState(null);
      } catch (error) {
        setUploadState('failed');
        setUploadPhase('idle');
        setUploadError(toErrorMessage(error, 'File upload failed.'));
      }
      return;
    }

    const { upload, file } = pending;
    if (!upload.uploadUrl) {
      return;
    }

    setUploadPhase('put');
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
        setUploadPhase('complete');
        const updatedAsset = await completeAdminAssetContentReplace(pending.assetId, {
          pendingS3Key: upload.pendingS3Key,
          fileName: pending.fileName,
          contentType: pending.contentType,
        });
        await applyUpdatedAsset(pending.assetId, updatedAsset);
        setUploadState('succeeded');
        setUploadPhase('idle');
        setUploadError('');
        setPendingUploadState(null);
        setReplaceSuccessNonce((n) => n + 1);
      } catch (completeFailure) {
        setUploadState('failed');
        setUploadPhase('idle');
        setUploadError(
          toErrorMessage(completeFailure, 'Failed to finalize file replacement.')
        );
        setPendingUploadState({
          kind: 'replace',
          stage: 'complete',
          assetId: pending.assetId,
          pendingS3Key: upload.pendingS3Key,
          fileName: pending.fileName,
          contentType: pending.contentType,
        });
      }
    } catch (error) {
      setUploadState('failed');
      setUploadPhase('idle');
      setUploadError(toErrorMessage(error, 'File upload failed.'));
    }
  }, [applyUpdatedAsset, setPendingUploadState]);

  return {
    assetMutationError,
    isSavingAsset,
    isDeletingAssetId,
    uploadState,
    uploadPhase,
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
