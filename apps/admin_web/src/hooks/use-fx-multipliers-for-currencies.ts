'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadFxMultipliersToAdminDefault, loadFxMultipliersToCurrency } from '@/lib/vendor-spend';

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

const DEFAULT_ERROR_MESSAGE = 'Could not load FX rates for currency conversion.';

export interface UseFxMultipliersForCurrenciesOptions {
  errorMessage?: string;
  /** When set to a valid ISO 4217 code, loads multipliers into that currency instead of the admin default. */
  targetCurrency?: string;
}

/**
 * Loads Frankfurter-based FX multipliers into the admin default currency, or into
 * {@link UseFxMultipliersForCurrenciesOptions.targetCurrency} when provided and valid.
 */
export function useFxMultipliersForCurrencies(
  currencyCodes: string[],
  enabled: boolean,
  options?: UseFxMultipliersForCurrenciesOptions,
): UseFxMultipliersForCurrenciesResult {
  const [fxMultipliers, setFxMultipliers] = useState<Map<string, number> | null>(null);
  const [fxError, setFxError] = useState('');

  const errorMessage = options?.errorMessage ?? DEFAULT_ERROR_MESSAGE;
  const rawTargetCurrency = options?.targetCurrency?.trim() ?? '';
  const normalizedTargetCurrency = rawTargetCurrency.toUpperCase();

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

    let useTargetOverride = false;
    let targetForLoad = '';
    if (rawTargetCurrency) {
      if (/^[A-Z]{3}$/.test(normalizedTargetCurrency)) {
        useTargetOverride = true;
        targetForLoad = normalizedTargetCurrency;
      } else if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined' && console.warn) {
        console.warn(
          `useFxMultipliersForCurrencies: invalid targetCurrency "${rawTargetCurrency}"; using admin default currency.`,
        );
      }
    }

    void (async () => {
      if (!cancelled) {
        setFxMultipliers(null);
      }
      try {
        const map = useTargetOverride
          ? await loadFxMultipliersToCurrency(codes, targetForLoad)
          : await loadFxMultipliersToAdminDefault(codes);
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
  }, [enabled, codesKey, errorMessage, rawTargetCurrency, normalizedTargetCurrency]);

  return { fxMultipliers, fxError };
}
