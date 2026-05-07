'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadFxMultipliersToAdminDefault } from '@/lib/vendor-spend';

import { toErrorMessage } from './hook-errors';

export interface UseFxMultipliersForCurrenciesResult {
  fxMultipliers: Map<string, number> | null;
  fxError: string;
}

/**
 * Loads Frankfurter-based FX multipliers into the admin default currency for the given codes.
 */
export function useFxMultipliersForCurrencies(
  currencyCodes: string[],
  enabled: boolean,
  errorMessage = 'Could not load FX rates for currency conversion.'
): UseFxMultipliersForCurrenciesResult {
  const [fxMultipliers, setFxMultipliers] = useState<Map<string, number> | null>(null);
  const [fxError, setFxError] = useState('');

  const codesKey = useMemo(() => {
    const unique = [...new Set(currencyCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
    unique.sort();
    return unique.join(',');
  }, [currencyCodes]);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setFxMultipliers(null);
        setFxError('');
      });
      return;
    }
    if (codesKey.length === 0) {
      queueMicrotask(() => {
        setFxMultipliers(new Map());
        setFxError('');
      });
      return;
    }
    const codes = codesKey.split(',').filter(Boolean);
    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        setFxMultipliers(null);
      }
      try {
        const map = await loadFxMultipliersToAdminDefault(codes);
        if (!cancelled) {
          setFxMultipliers(map);
          setFxError('');
        }
      } catch (err) {
        if (!cancelled) {
          setFxError(toErrorMessage(err, errorMessage));
          setFxMultipliers(new Map());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, codesKey, errorMessage]);

  return { fxMultipliers, fxError };
}
