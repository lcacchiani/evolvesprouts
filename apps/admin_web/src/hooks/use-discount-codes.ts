'use client';

import { useCallback, useState } from 'react';

import {
  createDiscountCode,
  deleteDiscountCode,
  listDiscountCodes,
  updateDiscountCode,
} from '@/lib/services-api';
import { DEFAULT_DISCOUNT_CODE_FILTERS } from '@/types/services';
import type { DiscountCode, DiscountCodeFilters } from '@/types/services';

import type { components } from '@/types/generated/admin-api.generated';

import { toErrorMessage } from './hook-errors';
import { usePaginatedList } from './use-paginated-list';

type ApiSchemas = components['schemas'];

const DEBOUNCE_KEYS: (keyof DiscountCodeFilters)[] = ['search'];

export function useDiscountCodes() {
  const fetcher = useCallback(
    (params: DiscountCodeFilters & { cursor: string | null; limit: number }) =>
      listDiscountCodes(params),
    []
  );

  const list = usePaginatedList<DiscountCode, DiscountCodeFilters>({
    fetcher,
    defaultFilters: DEFAULT_DISCOUNT_CODE_FILTERS,
    errorPrefix: 'Failed to load discount codes',
    debounceKeys: DEBOUNCE_KEYS,
  });

  const { refetch } = list;
  const [isSaving, setIsSaving] = useState(false);

  type MutateOptions = {
    /** When true, skip toggling `isSaving` (caller manages a longer-lived saving state). */
    suppressSaving?: boolean;
    /** When true, skip the post-mutation list refetch (caller will refetch once). */
    suppressRefetch?: boolean;
  };

  const mutate = useCallback(
    async <TResult>(
      work: () => Promise<TResult>,
      options: MutateOptions = {},
    ): Promise<TResult> => {
      const { suppressSaving = false, suppressRefetch = false } = options;
      if (!suppressSaving) {
        setIsSaving(true);
      }
      try {
        const result = await work();
        if (!suppressRefetch) {
          await refetch();
        }
        return result;
      } finally {
        if (!suppressSaving) {
          setIsSaving(false);
        }
      }
    },
    [refetch],
  );

  const createCode = useCallback(
    async (
      payload: ApiSchemas['CreateDiscountCodeRequest'],
      options: MutateOptions = {},
    ) => mutate(async () => createDiscountCode(payload), options),
    [mutate],
  );

  const updateCode = useCallback(
    async (codeId: string, payload: ApiSchemas['UpdateDiscountCodeRequest']) =>
      mutate(async () => updateDiscountCode(codeId, payload)),
    [mutate]
  );

  const deleteCode = useCallback(
    async (codeId: string) =>
      mutate(async () => {
        await deleteDiscountCode(codeId);
      }),
    [mutate]
  );

  return {
    codes: list.items,
    filters: list.filters,
    setFilter: list.setFilter,
    isLoading: list.isLoading,
    isLoadingMore: list.isLoadingMore,
    isSaving,
    error: list.error,
    refetch: list.refetch,
    loadMore: list.loadMore,
    hasMore: list.hasMore,
    totalCount: list.totalCount,
    createCode,
    updateCode,
    deleteCode,
  };
}
