'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { listLeads } from '@/lib/leads-api';
import { DEFAULT_LEAD_LIST_FILTERS } from '@/types/leads';
import type { LeadListFilters, LeadSummary } from '@/types/leads';

import { useDebouncedCallback } from './use-debounced-callback';

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useLeadList() {
  const [filters, setFilters] = useState<LeadListFilters>(DEFAULT_LEAD_LIST_FILTERS);
  const filtersRef = useRef<LeadListFilters>(DEFAULT_LEAD_LIST_FILTERS);
  const latestRequestIdRef = useRef(0);

  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refetch = useCallback(async (nextFilters?: Partial<LeadListFilters>) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const effectiveFilters = { ...filtersRef.current, ...(nextFilters ?? {}) };

    setIsLoading(true);
    setError('');
    try {
      const response = await listLeads({
        ...effectiveFilters,
        cursor: null,
        limit: 50,
      });
      if (latestRequestIdRef.current !== requestId) {
        return;
      }
      setLeads(response.items);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      if (latestRequestIdRef.current !== requestId) {
        return;
      }
      setError(toErrorMessage(err, 'Failed to load leads.'));
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
      const response = await listLeads({
        ...filtersRef.current,
        cursor: nextCursor,
        limit: 50,
      });
      setLeads((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load more leads.'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const debouncedRefresh = useDebouncedCallback((nextFilters: Partial<LeadListFilters>) => {
    void refetch(nextFilters);
  }, 300);

  const setFilter = useCallback(
    <TKey extends keyof LeadListFilters>(key: TKey, value: LeadListFilters[TKey]) => {
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
    filtersRef.current = DEFAULT_LEAD_LIST_FILTERS;
    setFilters(DEFAULT_LEAD_LIST_FILTERS);
    void refetch(DEFAULT_LEAD_LIST_FILTERS);
  }, [refetch]);

  return {
    leads,
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
