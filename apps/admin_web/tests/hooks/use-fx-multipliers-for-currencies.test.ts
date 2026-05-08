import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoad = vi.fn();

vi.mock('@/lib/vendor-spend', () => ({
  loadFxMultipliersToAdminDefault: (...args: unknown[]) => mockLoad(...args),
}));

import { useFxMultipliersForCurrencies } from '@/hooks/use-fx-multipliers-for-currencies';

describe('useFxMultipliersForCurrencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not load when disabled', () => {
    const { result } = renderHook(() => useFxMultipliersForCurrencies(['USD'], false));
    expect(result.current.fxMultipliers).toBeNull();
    expect(result.current.fxError).toBe('');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('uses an empty map when enabled with no currency codes', () => {
    const { result } = renderHook(() => useFxMultipliersForCurrencies([], true));
    expect(result.current.fxMultipliers).toEqual(new Map());
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('loads multipliers when enabled with codes', async () => {
    const map = new Map([['USD', 1.1]]);
    mockLoad.mockResolvedValue(map);
    const { result } = renderHook(() => useFxMultipliersForCurrencies(['usd'], true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLoad).toHaveBeenCalledWith(['USD']);
    expect(result.current.fxMultipliers).toEqual(map);
    expect(result.current.fxError).toBe('');
  });
});
