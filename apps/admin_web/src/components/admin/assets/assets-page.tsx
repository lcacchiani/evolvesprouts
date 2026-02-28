'use client';

import { AssetEditorPanel } from './asset-editor-panel';
import { AssetGrantsPanel } from './asset-grants-panel';
import { AssetListPanel } from './asset-list-panel';

import { StatusBanner } from '@/components/status-banner';
import { useAdminAssets } from '@/hooks/use-admin-assets';
import { getAdminApiConfigError } from '@/lib/config';

const DEFAULT_ASSET_TYPE = 'document' as const;
const DEFAULT_CONTENT_TYPE = 'application/pdf' as const;

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
    uploadState,
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
    loadMoreAssets,
    selectAsset,
    clearSelectedAsset,
    createAssetEntry,
    updateAssetEntry,
    deleteAssetEntry,
    createGrantEntry,
    deleteGrantEntry,
    retryPendingUpload,
  } = useAdminAssets();

  return (
    <div className='space-y-6'>
      {adminApiConfigError ? (
        <StatusBanner variant='error' title='Configuration'>
          {adminApiConfigError}
        </StatusBanner>
      ) : null}

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-2'>
        <AssetEditorPanel
          key={selectedAsset?.id ?? 'new-asset'}
          selectedAsset={selectedAsset}
          isSavingAsset={isSavingAsset}
          isDeletingCurrentAsset={Boolean(selectedAssetId) && isDeletingAssetId === selectedAssetId}
          assetMutationError={assetMutationError}
          uploadState={uploadState}
          uploadError={uploadError}
          hasPendingUpload={hasPendingUpload}
          onRetryUpload={retryPendingUpload}
          onCreate={async (payload, file) => {
            try {
              await createAssetEntry(
                {
                  ...payload,
                  assetType: DEFAULT_ASSET_TYPE,
                  contentType: DEFAULT_CONTENT_TYPE,
                },
                file
              );
            } catch {
              // The hook stores the actionable error state for UI display.
            }
          }}
          onUpdate={async (assetId, payload) => {
            try {
              await updateAssetEntry(assetId, {
                ...payload,
                assetType: DEFAULT_ASSET_TYPE,
                contentType: DEFAULT_CONTENT_TYPE,
              });
            } catch {
              // The hook stores the actionable error state for UI display.
            }
          }}
          onStartCreate={clearSelectedAsset}
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

      <AssetListPanel
        assets={assets}
        selectedAssetId={selectedAssetId}
        filters={filters}
        isLoadingAssets={isLoadingAssets}
        isLoadingMoreAssets={isLoadingMoreAssets}
        isDeletingAssetId={isDeletingAssetId}
        assetsError={assetsError}
        nextCursor={nextCursor}
        onQueryChange={setQueryFilter}
        onVisibilityChange={setVisibilityFilter}
        onLoadMore={loadMoreAssets}
        onSelectAsset={selectAsset}
        onDeleteAsset={async (assetId) => {
          try {
            await deleteAssetEntry(assetId);
          } catch {
            // The hook stores the actionable error state for UI display.
          }
        }}
      />
    </div>
  );
}
