'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createAdminAsset,
  createAdminAssetGrant,
  deleteAdminAsset,
  deleteAdminAssetGrant,
  listAdminAssetGrants,
  listAdminAssets,
  uploadFileToPresignedUrl,
  updateAdminAsset,
} from '@/lib/assets-api';
import { AdminApiError } from '@/lib/api-admin-client';
import type {
  AdminAsset,
  AssetGrant,
  AssetVisibility,
  CreateAssetGrantInput,
  CreatedAssetUpload,
  ListAdminAssetsInput,
  UpsertAdminAssetInput,
} from '@/types/assets';

type Filters = Pick<ListAdminAssetsInput, 'query' | 'visibility'>;

type UploadState = 'idle' | 'uploading' | 'failed' | 'succeeded';

const DEFAULT_FILTERS: Filters = {
  query: '',
  visibility: '',
};

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof AdminApiError) {
    if (error.statusCode === 404) {
      return 'Asset endpoints are not available in this deployment yet.';
    }
    if (error.statusCode === 403) {
      return 'You do not have permission to access assets.';
    }
    return error.message || fallbackMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
}

export function useAdminAssets() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const filtersRef = useRef<Filters>(DEFAULT_FILTERS);
  const [assets, setAssets] = useState<AdminAsset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isLoadingMoreAssets, setIsLoadingMoreAssets] = useState(false);
  const [assetsError, setAssetsError] = useState('');
  const [assetMutationError, setAssetMutationError] = useState('');
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isDeletingAssetId, setIsDeletingAssetId] = useState<string | null>(null);
  const [lastCreatedUpload, setLastCreatedUpload] = useState<CreatedAssetUpload | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState('');
  const [pendingUpload, setPendingUpload] = useState<{
    upload: CreatedAssetUpload;
    file: File;
  } | null>(null);

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [grants, setGrants] = useState<AssetGrant[]>([]);
  const [isLoadingGrants, setIsLoadingGrants] = useState(false);
  const [grantsError, setGrantsError] = useState('');
  const [grantMutationError, setGrantMutationError] = useState('');
  const [isSavingGrant, setIsSavingGrant] = useState(false);
  const [isDeletingGrantId, setIsDeletingGrantId] = useState<string | null>(null);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refreshAssets = useCallback(
    async (nextFilters?: Partial<Filters>) => {
      const effectiveFilters = {
        ...filtersRef.current,
        ...nextFilters,
      };

      setIsLoadingAssets(true);
      setAssetsError('');

      try {
        const response = await listAdminAssets({
          ...effectiveFilters,
          assetType: 'document',
          cursor: null,
          limit: 25,
        });
        setAssets(response.items);
        setNextCursor(response.nextCursor);

        setSelectedAssetId((currentId) => {
          if (!currentId) {
            return response.items[0]?.id ?? null;
          }
          return response.items.some((item) => item.id === currentId)
            ? currentId
            : (response.items[0]?.id ?? null);
        });
      } catch (error) {
        setAssetsError(toErrorMessage(error, 'Failed to load assets.'));
      } finally {
        setIsLoadingAssets(false);
      }
    },
    []
  );

  const loadMoreAssets = useCallback(async () => {
    if (!nextCursor) {
      return;
    }

    setIsLoadingMoreAssets(true);
    setAssetsError('');

    try {
      const response = await listAdminAssets({
        ...filtersRef.current,
        assetType: 'document',
        cursor: nextCursor,
        limit: 25,
      });
      setAssets((previous) => [...previous, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (error) {
      setAssetsError(toErrorMessage(error, 'Failed to load more assets.'));
    } finally {
      setIsLoadingMoreAssets(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const setQueryFilter = useCallback((query: string) => {
    setFilters((previous) => ({ ...previous, query }));
  }, []);

  const setVisibilityFilter = useCallback((visibility: AssetVisibility | '') => {
    setFilters((previous) => ({ ...previous, visibility }));
  }, []);

  const applyFilters = useCallback(async () => {
    await refreshAssets();
  }, [refreshAssets]);

  const clearFilters = useCallback(async () => {
    setFilters(DEFAULT_FILTERS);
    await refreshAssets(DEFAULT_FILTERS);
  }, [refreshAssets]);

  const selectAsset = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
    setAssetMutationError('');
    setGrantMutationError('');
    setLastCreatedUpload(null);
    setUploadState('idle');
    setUploadError('');
    setPendingUpload(null);
  }, []);

  const clearSelectedAsset = useCallback(() => {
    setSelectedAssetId(null);
    setGrantMutationError('');
    setLastCreatedUpload(null);
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
        setLastCreatedUpload(upload.uploadUrl ? upload : null);

        if (createdAsset) {
          setAssets((previous) => [createdAsset, ...previous]);
          setSelectedAssetId(createdAsset.id);
        } else {
          await refreshAssets();
        }

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
          setUploadError(toErrorMessage(uploadFailure, 'File upload failed.'));
        }
      } catch (error) {
        setAssetMutationError(toErrorMessage(error, 'Failed to create asset.'));
        throw error;
      } finally {
        setIsSavingAsset(false);
      }
    },
    [refreshAssets]
  );

  const updateAssetEntry = useCallback(
    async (assetId: string, input: UpsertAdminAssetInput) => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setLastCreatedUpload(null);
      setUploadState('idle');
      setUploadError('');
      setPendingUpload(null);

      try {
        const updatedAsset = await updateAdminAsset(assetId, input);
        if (!updatedAsset) {
          await refreshAssets();
          return;
        }

        setAssets((previous) =>
          previous.map((asset) => (asset.id === assetId ? updatedAsset : asset))
        );
      } catch (error) {
        setAssetMutationError(toErrorMessage(error, 'Failed to update asset.'));
        throw error;
      } finally {
        setIsSavingAsset(false);
      }
    },
    [refreshAssets]
  );

  const deleteAssetEntry = useCallback(async (assetId: string) => {
    setIsDeletingAssetId(assetId);
    setAssetMutationError('');
    setLastCreatedUpload(null);
    setUploadState('idle');
    setUploadError('');
    setPendingUpload(null);

    try {
      await deleteAdminAsset(assetId);
      setAssets((previous) => previous.filter((asset) => asset.id !== assetId));
      setSelectedAssetId((currentId) => (currentId === assetId ? null : currentId));
    } catch (error) {
      setAssetMutationError(toErrorMessage(error, 'Failed to delete asset.'));
      throw error;
    } finally {
      setIsDeletingAssetId(null);
    }
  }, []);

  const refreshGrants = useCallback(async (assetId: string) => {
    setIsLoadingGrants(true);
    setGrantsError('');

    try {
      const nextGrants = await listAdminAssetGrants(assetId);
      setGrants(nextGrants);
    } catch (error) {
      setGrantsError(toErrorMessage(error, 'Failed to load grants.'));
    } finally {
      setIsLoadingGrants(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedAssetId) {
      setGrants([]);
      setGrantsError('');
      return;
    }

    void refreshGrants(selectedAssetId);
  }, [refreshGrants, selectedAssetId]);

  const createGrantEntry = useCallback(
    async (assetId: string, input: CreateAssetGrantInput) => {
      setIsSavingGrant(true);
      setGrantMutationError('');

      try {
        await createAdminAssetGrant(assetId, input);
        await refreshGrants(assetId);
      } catch (error) {
        setGrantMutationError(toErrorMessage(error, 'Failed to create grant.'));
        throw error;
      } finally {
        setIsSavingGrant(false);
      }
    },
    [refreshGrants]
  );

  const deleteGrantEntry = useCallback(
    async (assetId: string, grantId: string) => {
      setIsDeletingGrantId(grantId);
      setGrantMutationError('');

      try {
        await deleteAdminAssetGrant(assetId, grantId);
        setGrants((previous) => previous.filter((grant) => grant.id !== grantId));
      } catch (error) {
        setGrantMutationError(toErrorMessage(error, 'Failed to delete grant.'));
        throw error;
      } finally {
        setIsDeletingGrantId(null);
      }
    },
    []
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
      setUploadError(toErrorMessage(error, 'File upload failed.'));
    }
  }, [pendingUpload]);

  return {
    filters,
    assets,
    nextCursor,
    isLoadingAssets,
    isLoadingMoreAssets,
    assetsError,
    assetMutationError,
    isSavingAsset,
    isDeletingAssetId,
    lastCreatedUpload,
    uploadState,
    uploadError,
    hasPendingUpload: Boolean(pendingUpload?.upload.uploadUrl),
    selectedAssetId,
    selectedAsset,
    grants,
    isLoadingGrants,
    grantsError,
    grantMutationError,
    isSavingGrant,
    isDeletingGrantId,
    setQueryFilter,
    setVisibilityFilter,
    applyFilters,
    clearFilters,
    refreshAssets,
    loadMoreAssets,
    selectAsset,
    clearSelectedAsset,
    createAssetEntry,
    updateAssetEntry,
    deleteAssetEntry,
    refreshGrants,
    createGrantEntry,
    deleteGrantEntry,
    retryPendingUpload,
    clearLastCreatedUpload: () => setLastCreatedUpload(null),
  };
}
