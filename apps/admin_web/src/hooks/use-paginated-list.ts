'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { toErrorMessage } from './hook-errors';
import { useDebouncedCallback } from './use-debounced-callback';

export interface PaginatedResponse<TItem> {
  items: TItem[];
  nextCursor: string | null;
  totalCount: number;
}

export interface UsePaginatedListOptions<TItem, TFilters extends object> {
  fetcher: (params: TFilters & { cursor: string | null; limit: number }) => Promise<PaginatedResponse<TItem>>;
  defaultFilters: TFilters;
  limit?: number;
  errorPrefix?: string;
  debounceKeys?: (keyof TFilters)[];
  debounceMs?: number;
  fetchOnMount?: boolean;
}

export interface UsePaginatedListReturn<TItem, TFilters extends object> {
  items: TItem[];
  setItems: Dispatch<SetStateAction<TItem[]>>;
  filters: TFilters;
  setFilter: <TKey extends keyof TFilters>(key: TKey, value: TFilters[TKey]) => void;
  clearFilters: () => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string;
  refetch: (nextFilters?: Partial<TFilters>) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  totalCount: number;
}

export function usePaginatedList<TItem, TFilters extends object>({
  fetcher,
  defaultFilters,
  limit = 50,
  errorPrefix = 'Failed to load',
  debounceKeys = [],
  debounceMs = 300,
  fetchOnMount = true,
}: UsePaginatedListOptions<TItem, TFilters>): UsePaginatedListReturn<TItem, TFilters> {
  const [filters, setFilters] = useState<TFilters>(defaultFilters);
  const filtersRef = useRef<TFilters>(defaultFilters);
  const latestRequestIdRef = useRef(0);

  const [items, setItems] = useState<TItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(fetchOnMount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refetch = useCallback(
    async (nextFilters?: Partial<TFilters>) => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      const effectiveFilters = { ...filtersRef.current, ...(nextFilters ?? {}) };

      setIsLoading(true);
      setError('');
      try {
        const response = await fetcher({
          ...effectiveFilters,
          cursor: null,
          limit,
        });
        if (latestRequestIdRef.current !== requestId) {
          return;
        }
        setItems(response.items);
        setNextCursor(response.nextCursor);
        setTotalCount(response.totalCount);
      } catch (err) {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }
        setError(toErrorMessage(err, `${errorPrefix}.`));
      } finally {
        if (latestRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [fetcher, limit, errorPrefix]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    setError('');
    try {
      const response = await fetcher({
        ...filtersRef.current,
        cursor: nextCursor,
        limit,
      });
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, `${errorPrefix} more.`));
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, fetcher, limit, errorPrefix]);

  useEffect(() => {
    if (fetchOnMount) {
      void refetch();
    }
  }, [refetch, fetchOnMount]);

  const debouncedRefresh = useDebouncedCallback((nextFilters: Partial<TFilters>) => {
    void refetch(nextFilters);
  }, debounceMs);

  const setFilter = useCallback(
    <TKey extends keyof TFilters>(key: TKey, value: TFilters[TKey]) => {
      const nextFilters = {
        ...filtersRef.current,
        [key]: value,
      };
      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      if (debounceKeys.includes(key)) {
        debouncedRefresh(nextFilters);
      } else {
        void refetch(nextFilters);
      }
    },
    [debouncedRefresh, refetch, debounceKeys]
  );

  const clearFilters = useCallback(() => {
    filtersRef.current = defaultFilters;
    setFilters(defaultFilters);
    void refetch(defaultFilters);
  }, [refetch, defaultFilters]);

  return {
    items,
    setItems,
    filters,
    setFilter,
    clearFilters,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    loadMore,
    hasMore: Boolean(nextCursor),
    totalCount,
  };
}
