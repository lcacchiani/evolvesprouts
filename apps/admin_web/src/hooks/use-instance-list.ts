'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { listInstances } from '@/lib/services-api';
import { DEFAULT_INSTANCE_LIST_FILTERS } from '@/types/services';
import type { InstanceListFilters, ServiceInstance } from '@/types/services';

import { toErrorMessage } from './hook-errors';

export function useInstanceList(serviceId: string | null) {
  const [filters, setFilters] = useState<InstanceListFilters>(DEFAULT_INSTANCE_LIST_FILTERS);
  const filtersRef = useRef<InstanceListFilters>(DEFAULT_INSTANCE_LIST_FILTERS);

  const [instances, setInstances] = useState<ServiceInstance[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refetch = useCallback(async () => {
    if (!serviceId) {
      setInstances([]);
      setNextCursor(null);
      setTotalCount(0);
      setError('');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await listInstances(serviceId, {
        status: filtersRef.current.status || undefined,
        cursor: null,
        limit: 50,
      });
      setInstances(response.items);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load service instances.'));
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadMore = useCallback(async () => {
    if (!serviceId || !nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    setError('');
    try {
      const response = await listInstances(serviceId, {
        status: filtersRef.current.status || undefined,
        cursor: nextCursor,
        limit: 50,
      });
      setInstances((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load more service instances.'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, serviceId]);

  const setFilter = useCallback(
    <TKey extends keyof InstanceListFilters>(key: TKey, value: InstanceListFilters[TKey]) => {
      const nextFilters = {
        ...filtersRef.current,
        [key]: value,
      };
      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      void refetch();
    },
    [refetch]
  );

  return {
    instances,
    filters,
    setFilter,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    loadMore,
    hasMore: Boolean(nextCursor),
    totalCount,
  };
}
