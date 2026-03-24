import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearCurrencyConversionRateCacheForTests,
  getCurrencyConversionMultiplier,
} from '@/lib/currency-converter';

describe('getCurrencyConversionMultiplier', () => {
  beforeEach(() => {
    clearCurrencyConversionRateCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCurrencyConversionRateCacheForTests();
  });

  it('returns 1 when from and to match', async () => {
    expect(await getCurrencyConversionMultiplier('HKD', 'HKD')).toBe(1);
  });

  it('fetches rate from Frankfurter API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ date: '2026-01-01', base: 'EUR', quote: 'HKD', rate: 9.5 }],
      })
    );

    expect(await getCurrencyConversionMultiplier('EUR', 'HKD')).toBe(9.5);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/v2/rates?base=EUR&quotes=HKD'));
  });
});
