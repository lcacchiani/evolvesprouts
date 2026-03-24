import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCurrencyConversionRateCacheForTests } from '@/lib/currency-converter';
import { computeVendorSpendInDefaultCurrencyByVendorId } from '@/lib/vendor-spend';
import type { Expense } from '@/types/expenses';

function baseExpense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e1',
    amendsExpenseId: null,
    status: 'paid',
    parseStatus: 'succeeded',
    vendorId: 'v1',
    vendorName: 'Vendor',
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    currency: 'HKD',
    subtotal: null,
    tax: null,
    total: '100.00',
    lineItems: [],
    parseConfidence: null,
    notes: null,
    voidReason: null,
    createdBy: '',
    updatedBy: null,
    createdAt: '',
    updatedAt: '',
    submittedAt: null,
    paidAt: null,
    voidedAt: null,
    attachments: [],
    ...overrides,
  };
}

describe('computeVendorSpendInDefaultCurrencyByVendorId', () => {
  beforeEach(() => {
    clearCurrencyConversionRateCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCurrencyConversionRateCacheForTests();
  });

  it('aggregates totals per vendor and skips voided', async () => {
    const expenses: Expense[] = [
      baseExpense({ id: 'a', vendorId: 'v1', total: '100', currency: 'HKD' }),
      baseExpense({ id: 'b', vendorId: 'v1', total: '50.5', currency: 'HKD' }),
      baseExpense({ id: 'c', vendorId: 'v2', total: '10', currency: 'HKD' }),
      baseExpense({ id: 'd', vendorId: 'v1', status: 'voided', total: '999', currency: 'HKD' }),
    ];

    const map = await computeVendorSpendInDefaultCurrencyByVendorId(expenses);
    expect(map.get('v1')).toBeCloseTo(150.5, 5);
    expect(map.get('v2')).toBeCloseTo(10, 5);
  });

  it('converts foreign currency via Frankfurter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ date: '2026-01-01', base: 'USD', quote: 'HKD', rate: 8 }],
      })
    );

    const expenses: Expense[] = [baseExpense({ id: 'u', vendorId: 'v1', total: '10', currency: 'USD' })];
    const map = await computeVendorSpendInDefaultCurrencyByVendorId(expenses);
    expect(map.get('v1')).toBeCloseTo(80, 5);
  });
});
