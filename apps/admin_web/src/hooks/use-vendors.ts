'use client';

import { useCallback, useState } from 'react';

import { createAdminVendor, listAdminVendors, updateAdminVendor } from '@/lib/vendors-api';
import { DEFAULT_VENDOR_FILTERS } from '@/types/vendors';
import type { Vendor, VendorFilters } from '@/types/vendors';
import type { components } from '@/types/generated/admin-api.generated';

import { usePaginatedList } from './use-paginated-list';

type ApiSchemas = components['schemas'];

export function useVendors() {
  const fetcher = useCallback(
    (params: VendorFilters & { cursor: string | null; limit: number }) => listAdminVendors(params),
    []
  );

  const list = usePaginatedList<Vendor, VendorFilters>({
    fetcher,
    defaultFilters: DEFAULT_VENDOR_FILTERS,
    errorPrefix: 'Failed to load vendors',
    debounceKeys: ['query'],
  });

  const [isSaving, setIsSaving] = useState(false);

  const mutate = useCallback(
    async <TResult>(work: () => Promise<TResult>): Promise<TResult> => {
      setIsSaving(true);
      try {
        const result = await work();
        await list.refetch();
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    [list]
  );

  const createVendor = useCallback(
    async (payload: ApiSchemas['CreateVendorRequest']) => mutate(async () => createAdminVendor(payload)),
    [mutate]
  );

  const updateVendor = useCallback(
    async (vendorId: string, payload: ApiSchemas['UpdateVendorRequest']) =>
      mutate(async () => updateAdminVendor(vendorId, payload)),
    [mutate]
  );

  return {
    vendors: list.items,
    filters: list.filters,
    setFilter: list.setFilter,
    isLoading: list.isLoading,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    error: list.error,
    loadMore: list.loadMore,
    totalCount: list.totalCount,
    isSaving,
    createVendor,
    updateVendor,
    refetch: list.refetch,
  };
}
