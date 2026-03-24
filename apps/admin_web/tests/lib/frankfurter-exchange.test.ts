import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearFrankfurterRateCacheForTests, getHkdMultiplier } from '@/lib/frankfurter-exchange';

describe('getHkdMultiplier', () => {
  beforeEach(() => {
    clearFrankfurterRateCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearFrankfurterRateCacheForTests();
  });

  it('returns 1 for HKD', async () => {
    expect(await getHkdMultiplier('HKD')).toBe(1);
  });

  it('fetches rate from Frankfurter API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ date: '2026-01-01', base: 'EUR', quote: 'HKD', rate: 9.5 }],
      })
    );

    expect(await getHkdMultiplier('EUR')).toBe(9.5);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/v2/rates?base=EUR&quotes=HKD'));
  });
});
