'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadFxMultipliersToAdminDefault } from '@/lib/vendor-spend';

import { toErrorMessage } from './hook-errors';

export interface UseFxMultipliersForCurrenciesResult {
  /**
   * FX multipliers map, or `null` while loading (only when `enabled` is true and codes are non-empty).
   * When `enabled` is false, this is always `null`. When enabled with an empty deduped code list,
   * this is an empty `Map` (nothing to convert).
   */
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
    /* Sync reset paths must run in the effect body (not microtasks) so cleanup cancellation
     * applies consistently when `enabled` or codes change — see PR 1585 remediation P2. */
    /* eslint-disable react-hooks/set-state-in-effect -- intentional synchronous reset */
    if (!enabled) {
      setFxMultipliers(null);
      setFxError('');
      return;
    }
    if (codesKey.length === 0) {
      setFxMultipliers(new Map());
      setFxError('');
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
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
