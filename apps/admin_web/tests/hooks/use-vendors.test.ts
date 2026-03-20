import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateAdminVendor, mockUpdateAdminVendor, mockRefetch, paginatedState } = vi.hoisted(() => {
  const mockRefetch = vi.fn().mockResolvedValue(undefined);
  const paginatedState = {
    items: [],
    filters: { query: '', active: '' },
    setFilter: vi.fn(),
    clearFilters: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    error: '',
    refetch: mockRefetch,
    loadMore: vi.fn(),
    hasMore: false,
    totalCount: 0,
  };

  return {
    mockCreateAdminVendor: vi.fn(),
    mockUpdateAdminVendor: vi.fn(),
    mockRefetch,
    paginatedState,
  };
});

vi.mock('@/hooks/use-paginated-list', () => ({
  usePaginatedList: vi.fn(() => paginatedState),
}));

vi.mock('@/lib/vendors-api', () => ({
  listAdminVendors: vi.fn(),
  createAdminVendor: mockCreateAdminVendor,
  updateAdminVendor: mockUpdateAdminVendor,
}));

import { useVendors } from '@/hooks/use-vendors';

describe('useVendors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates vendor and refetches', async () => {
    mockCreateAdminVendor.mockResolvedValue({ id: 'vendor-1' });
    const { result } = renderHook(() => useVendors());

    await act(async () => {
      await result.current.createVendor({
        name: 'Acme Vendor',
        website: null,
        active: true,
      });
    });

    expect(mockCreateAdminVendor).toHaveBeenCalledWith({
      name: 'Acme Vendor',
      website: null,
      active: true,
    });
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('updates vendor and refetches', async () => {
    mockUpdateAdminVendor.mockResolvedValue({ id: 'vendor-1' });
    const { result } = renderHook(() => useVendors());

    await act(async () => {
      await result.current.updateVendor('vendor-1', {
        name: 'Acme Vendor Updated',
        website: null,
        active: false,
      });
    });

    expect(mockUpdateAdminVendor).toHaveBeenCalledWith('vendor-1', {
      name: 'Acme Vendor Updated',
      website: null,
      active: false,
    });
    expect(mockRefetch).toHaveBeenCalled();
  });
});
