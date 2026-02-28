import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUseAssetList,
  mockUseAssetMutations,
  mockUseAssetGrants,
  mockSelectAssetInList,
  mockClearSelectedAssetInList,
  mockResetMutationState,
  mockClearGrantMutationError,
  listState,
  mutationState,
  grantsState,
} = vi.hoisted(() => {
  const mockSelectAssetInList = vi.fn();
  const mockClearSelectedAssetInList = vi.fn();
  const mockResetMutationState = vi.fn();
  const mockClearGrantMutationError = vi.fn();

  const listState = {
    filters: { query: '', visibility: '' },
    assets: [],
    nextCursor: null,
    isLoadingAssets: false,
    isLoadingMoreAssets: false,
    assetsError: '',
    selectedAssetId: 'asset-1',
    selectedAsset: { id: 'asset-1', title: 'Asset 1' },
    setQueryFilter: vi.fn(),
    setVisibilityFilter: vi.fn(),
    refreshAssets: vi.fn(),
    loadMoreAssets: vi.fn(),
    selectAsset: mockSelectAssetInList,
    clearSelectedAsset: mockClearSelectedAssetInList,
    applyCreatedAsset: vi.fn(),
    applyUpdatedAsset: vi.fn(),
    applyDeletedAsset: vi.fn(),
  };

  const mutationState = {
    assetMutationError: '',
    isSavingAsset: false,
    isDeletingAssetId: null,
    uploadState: 'idle',
    uploadError: '',
    hasPendingUpload: false,
    createAssetEntry: vi.fn(),
    updateAssetEntry: vi.fn(),
    deleteAssetEntry: vi.fn(),
    retryPendingUpload: vi.fn(),
    resetMutationState: mockResetMutationState,
  };

  const grantsState = {
    grants: [],
    isLoadingGrants: false,
    grantsError: '',
    grantMutationError: '',
    isSavingGrant: false,
    isDeletingGrantId: null,
    refreshGrants: vi.fn(),
    createGrantEntry: vi.fn(),
    deleteGrantEntry: vi.fn(),
    clearGrantMutationError: mockClearGrantMutationError,
  };

  return {
    mockUseAssetList: vi.fn(() => listState),
    mockUseAssetMutations: vi.fn(() => mutationState),
    mockUseAssetGrants: vi.fn(() => grantsState),
    mockSelectAssetInList,
    mockClearSelectedAssetInList,
    mockResetMutationState,
    mockClearGrantMutationError,
    listState,
    mutationState,
    grantsState,
  };
});

vi.mock('@/hooks/use-asset-list', () => ({
  useAssetList: mockUseAssetList,
}));

vi.mock('@/hooks/use-asset-mutations', () => ({
  useAssetMutations: mockUseAssetMutations,
}));

vi.mock('@/hooks/use-asset-grants', () => ({
  useAssetGrants: mockUseAssetGrants,
}));

import { useAdminAssets } from '@/hooks/use-admin-assets';

describe('useAdminAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssetList.mockReturnValue(listState);
    mockUseAssetMutations.mockReturnValue(mutationState);
    mockUseAssetGrants.mockReturnValue(grantsState);
  });

  it('passes list callbacks into useAssetMutations', () => {
    renderHook(() => useAdminAssets());

    expect(mockUseAssetMutations).toHaveBeenCalledWith({
      applyCreatedAsset: listState.applyCreatedAsset,
      applyUpdatedAsset: listState.applyUpdatedAsset,
      applyDeletedAsset: listState.applyDeletedAsset,
    });
  });

  it('selectAsset clears mutation and grant error state', () => {
    const { result } = renderHook(() => useAdminAssets());

    act(() => {
      result.current.selectAsset('asset-2');
    });

    expect(mockSelectAssetInList).toHaveBeenCalledWith('asset-2');
    expect(mockResetMutationState).toHaveBeenCalledTimes(1);
    expect(mockClearGrantMutationError).toHaveBeenCalledTimes(1);
  });

  it('clearSelectedAsset resets related state and delegates', () => {
    const { result } = renderHook(() => useAdminAssets());

    act(() => {
      result.current.clearSelectedAsset();
    });

    expect(mockClearSelectedAssetInList).toHaveBeenCalledTimes(1);
    expect(mockResetMutationState).toHaveBeenCalledTimes(1);
    expect(mockClearGrantMutationError).toHaveBeenCalledTimes(1);
  });

  it('returns merged state and actions from composed hooks', () => {
    const { result } = renderHook(() => useAdminAssets());

    expect(result.current.filters).toEqual(listState.filters);
    expect(result.current.assets).toEqual(listState.assets);
    expect(result.current.assetMutationError).toBe(mutationState.assetMutationError);
    expect(result.current.grants).toEqual(grantsState.grants);
    expect(result.current.createAssetEntry).toBe(mutationState.createAssetEntry);
    expect(result.current.createGrantEntry).toBe(grantsState.createGrantEntry);
  });
});
