'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createAdminAsset,
  createAdminAssetGrant,
  deleteAdminAsset,
  deleteAdminAssetGrant,
  listAdminAssetGrants,
  listAdminAssets,
  updateAdminAsset,
} from '@/lib/assets-api';
import type {
  AdminAsset,
  AssetGrant,
  AssetType,
  AssetVisibility,
  CreateAssetGrantInput,
  CreatedAssetUpload,
  ListAdminAssetsInput,
  UpsertAdminAssetInput,
} from '@/types/assets';

type Filters = Omit<ListAdminAssetsInput, 'cursor' | 'limit'>;

const DEFAULT_FILTERS: Filters = {
  query: '',
  visibility: '',
  assetType: '',
};

function toErrorMessage(error: unknown, fallbackMessage: string): string {
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

  const setAssetTypeFilter = useCallback((assetType: AssetType | '') => {
    setFilters((previous) => ({ ...previous, assetType }));
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
  }, []);

  const clearSelectedAsset = useCallback(() => {
    setSelectedAssetId(null);
    setGrantMutationError('');
    setLastCreatedUpload(null);
  }, []);

  const createAssetEntry = useCallback(async (input: UpsertAdminAssetInput) => {
    setIsSavingAsset(true);
    setAssetMutationError('');

    try {
      const result = await createAdminAsset(input);
      setLastCreatedUpload(result.upload.uploadUrl ? result.upload : null);
      const createdAsset = result.asset;

      if (createdAsset) {
        setAssets((previous) => [createdAsset, ...previous]);
        setSelectedAssetId(createdAsset.id);
      } else {
        await refreshAssets();
      }
    } catch (error) {
      setAssetMutationError(toErrorMessage(error, 'Failed to create asset.'));
      throw error;
    } finally {
      setIsSavingAsset(false);
    }
  }, [refreshAssets]);

  const updateAssetEntry = useCallback(
    async (assetId: string, input: UpsertAdminAssetInput) => {
      setIsSavingAsset(true);
      setAssetMutationError('');
      setLastCreatedUpload(null);

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
    setAssetTypeFilter,
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
    clearLastCreatedUpload: () => setLastCreatedUpload(null),
  };
}
