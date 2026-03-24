'use client';

import { useCallback, useEffect, useState } from 'react';

import { computeVendorSpendHkdByVendorId } from '@/lib/vendor-spend-hkd';
import type { Expense } from '@/types/expenses';

import { toErrorMessage } from './hook-errors';

export function useVendorSpendHkd(expenses: Expense[] | null) {
  const [byVendorId, setByVendorId] = useState<Map<string, number>>(() => new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const recompute = useCallback(async (items: Expense[]) => {
    setIsLoading(true);
    setError('');
    try {
      const next = await computeVendorSpendHkdByVendorId(items);
      setByVendorId(next);
    } catch (err) {
      setError(toErrorMessage(err, 'Could not load FX rates for spend totals.'));
      setByVendorId(new Map());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expenses === null) {
      setByVendorId(new Map());
      setError('');
      setIsLoading(false);
      return;
    }
    void recompute(expenses);
  }, [expenses, recompute]);

  return { byVendorId, isLoading, error };
}
