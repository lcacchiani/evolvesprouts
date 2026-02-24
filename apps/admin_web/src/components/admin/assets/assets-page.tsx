'use client';

import { AssetEditorPanel } from './asset-editor-panel';
import { AssetGrantsPanel } from './asset-grants-panel';
import { AssetListPanel } from './asset-list-panel';

import { StatusBanner } from '@/components/status-banner';
import { useAdminAssets } from '@/hooks/use-admin-assets';
import { getAdminApiConfigError } from '@/lib/config';

export function AssetsPage() {
  const adminApiConfigError = getAdminApiConfigError();
  const {
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
    createGrantEntry,
    deleteGrantEntry,
    clearLastCreatedUpload,
  } = useAdminAssets();

  return (
    <div className='space-y-6'>
      {adminApiConfigError ? (
        <StatusBanner variant='error' title='Configuration'>
          {adminApiConfigError}
        </StatusBanner>
      ) : null}

      <AssetListPanel
        assets={assets}
        selectedAssetId={selectedAssetId}
        filters={filters}
        isLoadingAssets={isLoadingAssets}
        isLoadingMoreAssets={isLoadingMoreAssets}
        assetsError={assetsError}
        nextCursor={nextCursor}
        onQueryChange={setQueryFilter}
        onVisibilityChange={setVisibilityFilter}
        onAssetTypeChange={setAssetTypeFilter}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
        onRefresh={refreshAssets}
        onLoadMore={loadMoreAssets}
        onSelectAsset={selectAsset}
      />

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-2'>
        <AssetEditorPanel
          key={selectedAsset?.id ?? 'new-asset'}
          selectedAsset={selectedAsset}
          isSavingAsset={isSavingAsset}
          isDeletingCurrentAsset={
            Boolean(selectedAssetId) && isDeletingAssetId === selectedAssetId
          }
          assetMutationError={assetMutationError}
          lastCreatedUpload={lastCreatedUpload}
          onCreate={async (payload) => {
            try {
              await createAssetEntry(payload);
            } catch {
              // The hook stores the actionable error state for UI display.
            }
          }}
          onUpdate={async (assetId, payload) => {
            try {
              await updateAssetEntry(assetId, payload);
            } catch {
              // The hook stores the actionable error state for UI display.
            }
          }}
          onDelete={async (assetId) => {
            try {
              await deleteAssetEntry(assetId);
            } catch {
              // The hook stores the actionable error state for UI display.
            }
          }}
          onStartCreate={clearSelectedAsset}
          onDismissUploadNotice={clearLastCreatedUpload}
        />

        <AssetGrantsPanel
          selectedAsset={selectedAsset}
          grants={grants}
          isLoadingGrants={isLoadingGrants}
          grantsError={grantsError}
          grantMutationError={grantMutationError}
          isSavingGrant={isSavingGrant}
          isDeletingGrantId={isDeletingGrantId}
          onCreateGrant={async (assetId, input) => {
            try {
              await createGrantEntry(assetId, input);
            } catch {
              // The hook stores the actionable error state for UI display.
            }
          }}
          onDeleteGrant={async (assetId, grantId) => {
            try {
              await deleteGrantEntry(assetId, grantId);
            } catch {
              // The hook stores the actionable error state for UI display.
            }
          }}
        />
      </div>
    </div>
  );
}
