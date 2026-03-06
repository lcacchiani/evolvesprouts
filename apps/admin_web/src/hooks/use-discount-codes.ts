'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
import { useDebouncedCallback } from './use-debounced-callback';

type ApiSchemas = components['schemas'];

export function useDiscountCodes() {
  const [filters, setFilters] = useState<DiscountCodeFilters>(DEFAULT_DISCOUNT_CODE_FILTERS);
  const filtersRef = useRef<DiscountCodeFilters>(DEFAULT_DISCOUNT_CODE_FILTERS);

  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refetch = useCallback(async (nextFilters?: Partial<DiscountCodeFilters>) => {
    const effectiveFilters = { ...filtersRef.current, ...(nextFilters ?? {}) };
    setIsLoading(true);
    setError('');
    try {
      const response = await listDiscountCodes({
        ...effectiveFilters,
        cursor: null,
        limit: 50,
      });
      setCodes(response.items);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load discount codes.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    setError('');
    try {
      const response = await listDiscountCodes({
        ...filtersRef.current,
        cursor: nextCursor,
        limit: 50,
      });
      setCodes((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load more discount codes.'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor]);

  const debouncedRefresh = useDebouncedCallback((nextFilters: Partial<DiscountCodeFilters>) => {
    void refetch(nextFilters);
  }, 300);

  const setFilter = useCallback(
    <TKey extends keyof DiscountCodeFilters>(key: TKey, value: DiscountCodeFilters[TKey]) => {
      const nextFilters = {
        ...filtersRef.current,
        [key]: value,
      };
      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      if (key === 'search') {
        debouncedRefresh(nextFilters);
      } else {
        void refetch(nextFilters);
      }
    },
    [debouncedRefresh, refetch]
  );

  const mutate = useCallback(async <TResult>(work: () => Promise<TResult>): Promise<TResult> => {
    setIsSaving(true);
    setError('');
    try {
      const result = await work();
      await refetch();
      return result;
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to save discount code changes.'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [refetch]);

  const createCode = useCallback(
    async (payload: ApiSchemas['CreateDiscountCodeRequest']) =>
      mutate(async () => createDiscountCode(payload)),
    [mutate]
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
    codes,
    filters,
    setFilter,
    isLoading,
    isLoadingMore,
    isSaving,
    error,
    refetch,
    loadMore,
    hasMore: Boolean(nextCursor),
    totalCount,
    createCode,
    updateCode,
    deleteCode,
  };
}
