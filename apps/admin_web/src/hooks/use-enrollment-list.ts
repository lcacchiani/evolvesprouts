'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { clampAdminListLimit } from '@/lib/admin-list-limit';
import { listEnrollments } from '@/lib/services-api';
import { DEFAULT_ENROLLMENT_LIST_FILTERS } from '@/types/services';
import type { Enrollment, EnrollmentListFilters } from '@/types/services';

import { toErrorMessage } from './hook-errors';

export function useEnrollmentList(serviceId: string | null, instanceId: string | null) {
  const [filters, setFilters] = useState<EnrollmentListFilters>(DEFAULT_ENROLLMENT_LIST_FILTERS);
  const filtersRef = useRef<EnrollmentListFilters>(DEFAULT_ENROLLMENT_LIST_FILTERS);

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refetch = useCallback(async () => {
    if (!serviceId || !instanceId) {
      setEnrollments([]);
      setNextCursor(null);
      setTotalCount(0);
      setError('');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await listEnrollments(
        serviceId,
        instanceId,
        {
          status: filtersRef.current.status || undefined,
          cursor: null,
          limit: clampAdminListLimit(50),
        },
        undefined
      );
      setEnrollments(response.items);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load enrollments.'));
    } finally {
      setIsLoading(false);
    }
  }, [instanceId, serviceId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadMore = useCallback(async () => {
    if (!serviceId || !instanceId || !nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    setError('');
    try {
      const response = await listEnrollments(serviceId, instanceId, {
        status: filtersRef.current.status || undefined,
        cursor: nextCursor,
        limit: clampAdminListLimit(50),
      });
      setEnrollments((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load more enrollments.'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [instanceId, nextCursor, serviceId]);

  const setFilter = useCallback(
    <TKey extends keyof EnrollmentListFilters>(
      key: TKey,
      value: EnrollmentListFilters[TKey]
    ) => {
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
    enrollments,
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
