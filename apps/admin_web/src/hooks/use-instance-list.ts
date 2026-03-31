'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { listAllInstances, listInstances } from '@/lib/services-api';
import { DEFAULT_INSTANCE_LIST_FILTERS } from '@/types/services';
import type { InstanceListFilters, ServiceInstance } from '@/types/services';

import { toErrorMessage } from './hook-errors';

export interface InstanceListGlobalOptions {
  /** When true and serviceId is null, load via GET /v1/admin/services/instances. */
  listAllEventInstances?: boolean;
  /** Optional service UUID filter (only used with listAllEventInstances). */
  filterServiceId?: string | null;
}

export function useInstanceList(
  serviceId: string | null,
  globalOptions: InstanceListGlobalOptions | null = null
) {
  const [filters, setFilters] = useState<InstanceListFilters>(DEFAULT_INSTANCE_LIST_FILTERS);
  const filtersRef = useRef<InstanceListFilters>(DEFAULT_INSTANCE_LIST_FILTERS);

  const [instances, setInstances] = useState<ServiceInstance[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const listAllEventInstances = Boolean(globalOptions?.listAllEventInstances);
  const filterServiceId = globalOptions?.filterServiceId?.trim() ?? '';

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refetch = useCallback(async () => {
    const useGlobalList = !serviceId && listAllEventInstances;
    if (!serviceId && !useGlobalList) {
      setInstances([]);
      setNextCursor(null);
      setTotalCount(0);
      setError('');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const status = filtersRef.current.status || undefined;
      const response = useGlobalList
        ? await listAllInstances({
            status,
            cursor: null,
            limit: 50,
            serviceType: 'event',
            serviceId: filterServiceId || undefined,
          })
        : await listInstances(serviceId as string, {
            status,
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
  }, [serviceId, listAllEventInstances, filterServiceId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadMore = useCallback(async () => {
    const useGlobalList = !serviceId && listAllEventInstances;
    if ((!serviceId && !useGlobalList) || !nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    setError('');
    try {
      const status = filtersRef.current.status || undefined;
      const response = useGlobalList
        ? await listAllInstances({
            status,
            cursor: nextCursor,
            limit: 50,
            serviceType: 'event',
            serviceId: filterServiceId || undefined,
          })
        : await listInstances(serviceId as string, {
            status,
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
  }, [nextCursor, serviceId, listAllEventInstances, filterServiceId]);

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
