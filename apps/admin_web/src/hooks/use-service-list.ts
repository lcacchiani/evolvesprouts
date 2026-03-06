'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { listServices } from '@/lib/services-api';
import { DEFAULT_SERVICE_LIST_FILTERS } from '@/types/services';
import type { ServiceListFilters, ServiceSummary } from '@/types/services';

import { toErrorMessage } from './hook-errors';
import { useDebouncedCallback } from './use-debounced-callback';

export function useServiceList() {
  const [filters, setFilters] = useState<ServiceListFilters>(DEFAULT_SERVICE_LIST_FILTERS);
  const filtersRef = useRef<ServiceListFilters>(DEFAULT_SERVICE_LIST_FILTERS);
  const latestRequestIdRef = useRef(0);

  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refetch = useCallback(async (nextFilters?: Partial<ServiceListFilters>) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const effectiveFilters = { ...filtersRef.current, ...(nextFilters ?? {}) };
    setIsLoading(true);
    setError('');
    try {
      const response = await listServices({
        ...effectiveFilters,
        cursor: null,
        limit: 50,
      });
      if (latestRequestIdRef.current !== requestId) {
        return;
      }
      setServices(response.items);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      if (latestRequestIdRef.current !== requestId) {
        return;
      }
      setError(toErrorMessage(err, 'Failed to load services.'));
    } finally {
      if (latestRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    setError('');
    try {
      const response = await listServices({
        ...filtersRef.current,
        cursor: nextCursor,
        limit: 50,
      });
      setServices((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load more services.'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const debouncedRefresh = useDebouncedCallback((nextFilters: Partial<ServiceListFilters>) => {
    void refetch(nextFilters);
  }, 300);

  const setFilter = useCallback(
    <TKey extends keyof ServiceListFilters>(key: TKey, value: ServiceListFilters[TKey]) => {
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

  const clearFilters = useCallback(() => {
    filtersRef.current = DEFAULT_SERVICE_LIST_FILTERS;
    setFilters(DEFAULT_SERVICE_LIST_FILTERS);
    void refetch(DEFAULT_SERVICE_LIST_FILTERS);
  }, [refetch]);

  return {
    services,
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
