import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadAdmin = vi.fn();
const mockLoadCurrency = vi.fn();

vi.mock('@/lib/vendor-spend', () => ({
  loadFxMultipliersToAdminDefault: (...args: unknown[]) => mockLoadAdmin(...args),
  loadFxMultipliersToCurrency: (...args: unknown[]) => mockLoadCurrency(...args),
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
    expect(mockLoadAdmin).not.toHaveBeenCalled();
    expect(mockLoadCurrency).not.toHaveBeenCalled();
  });

  it('uses an empty map when enabled with no currency codes', () => {
    const { result } = renderHook(() => useFxMultipliersForCurrencies([], true));
    expect(result.current.fxMultipliers).toEqual(new Map());
    expect(mockLoadAdmin).not.toHaveBeenCalled();
    expect(mockLoadCurrency).not.toHaveBeenCalled();
  });

  it('loads multipliers when enabled with codes', async () => {
    const map = new Map([['USD', 1.1]]);
    mockLoadAdmin.mockResolvedValue(map);
    const { result } = renderHook(() => useFxMultipliersForCurrencies(['usd'], true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLoadAdmin).toHaveBeenCalledWith(['USD']);
    expect(mockLoadCurrency).not.toHaveBeenCalled();
    expect(result.current.fxMultipliers).toEqual(map);
    expect(result.current.fxError).toBe('');
  });

  it('loads into an override target currency when a valid ISO code is provided', async () => {
    const map = new Map([['USD', 7.8]]);
    mockLoadCurrency.mockResolvedValue(map);
    const { result } = renderHook(() =>
      useFxMultipliersForCurrencies(['usd'], true, 'Could not load FX rates for currency conversion.', 'HKD')
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLoadCurrency).toHaveBeenCalledWith(['USD'], 'HKD');
    expect(mockLoadAdmin).not.toHaveBeenCalled();
    expect(result.current.fxMultipliers).toEqual(map);
    expect(result.current.fxError).toBe('');
  });
});
