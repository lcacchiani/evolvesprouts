'use client';

import { useCallback } from 'react';

import { useAssetGrants } from './use-asset-grants';
import { useAssetList } from './use-asset-list';
import { useAssetMutations } from './use-asset-mutations';

export function useAdminAssets() {
  const {
    filters,
    assets,
    linkedTagNames,
    nextCursor,
    isLoadingAssets,
    isLoadingMoreAssets,
    assetsError,
    selectedAssetId,
    selectedAsset,
    setQueryFilter,
    setVisibilityFilter,
    setTagNameFilter,
    refreshAssets,
    loadMoreAssets,
    selectAsset: selectAssetInList,
    clearSelectedAsset: clearSelectedAssetInList,
    applyCreatedAsset,
    applyUpdatedAsset,
    applyDeletedAsset,
  } = useAssetList();

  const {
    assetMutationError,
    isSavingAsset,
    isDeletingAssetId,
    uploadState,
    uploadPhase,
    uploadError,
    hasPendingUpload,
    createAssetEntry,
    replaceAssetFileEntry,
    updateAssetEntry,
    deleteAssetEntry,
    retryPendingUpload,
    resetMutationState,
    replaceSuccessNonce,
  } = useAssetMutations({
    applyCreatedAsset,
    applyUpdatedAsset,
    applyDeletedAsset,
  });

  const {
    grants,
    isLoadingGrants,
    grantsError,
    grantMutationError,
    isSavingGrant,
    isDeletingGrantId,
    refreshGrants,
    createGrantEntry,
    deleteGrantEntry,
    clearGrantMutationError,
  } = useAssetGrants(selectedAssetId);

  const selectAsset = useCallback(
    (assetId: string) => {
      selectAssetInList(assetId);
      resetMutationState();
      clearGrantMutationError();
    },
    [clearGrantMutationError, resetMutationState, selectAssetInList]
  );

  const clearSelectedAsset = useCallback(() => {
    clearSelectedAssetInList();
    clearGrantMutationError();
    resetMutationState();
  }, [clearGrantMutationError, clearSelectedAssetInList, resetMutationState]);

  return {
    filters,
    assets,
    linkedTagNames,
    nextCursor,
    isLoadingAssets,
    isLoadingMoreAssets,
    assetsError,
    assetMutationError,
    isSavingAsset,
    isDeletingAssetId,
    uploadState,
    uploadPhase,
    uploadError,
    hasPendingUpload,
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
    setTagNameFilter,
    refreshAssets,
    loadMoreAssets,
    selectAsset,
    clearSelectedAsset,
    createAssetEntry,
    replaceAssetFileEntry,
    updateAssetEntry,
    deleteAssetEntry,
    refreshGrants,
    createGrantEntry,
    deleteGrantEntry,
    retryPendingUpload,
    replaceSuccessNonce,
  };
}
