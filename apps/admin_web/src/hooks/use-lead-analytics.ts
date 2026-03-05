'use client';

import { useCallback, useEffect, useState } from 'react';

import { getLeadAnalytics } from '@/lib/leads-api';
import type { LeadAnalytics } from '@/types/leads';

export interface DateRange {
  dateFrom: string | null;
  dateTo: string | null;
}

const DEFAULT_DATE_RANGE: DateRange = {
  dateFrom: null,
  dateTo: null,
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useLeadAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [analytics, setAnalytics] = useState<LeadAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getLeadAnalytics({
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
      });
      setAnalytics(response);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load analytics.'));
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.dateFrom, dateRange.dateTo]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    analytics,
    dateRange,
    setDateRange,
    isLoading,
    error,
    refetch,
  };
}
