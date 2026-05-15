import { describe, expect, it } from 'vitest';

import { sumTaxFiscalYearKindInHkd } from '@/lib/dashboard-tax-position-sums';
import type { TaxFiscalYearRow } from '@/lib/tax-fiscal-year-report';

function row(
  partial: Pick<TaxFiscalYearRow, 'kind' | 'amount' | 'currency'>,
): TaxFiscalYearRow {
  return {
    classificationDate: '2025-06-01',
    description: 'x',
    tax: '0',
    referenceId: partial.kind === 'revenue' ? 'r1' : 'e1',
    needsInvoiceDateWarning: false,
    invoiceNumber: null,
    ...partial,
  };
}

describe('sumTaxFiscalYearKindInHkd', () => {
  it('sums HKD rows for the requested kind', () => {
    const rows: TaxFiscalYearRow[] = [
      row({ kind: 'revenue', amount: '100', currency: 'HKD' }),
      row({ kind: 'revenue', amount: '50.5', currency: 'HKD' }),
      row({ kind: 'expense', amount: '999', currency: 'HKD' }),
    ];
    const empty = new Map<string, number>();
    expect(sumTaxFiscalYearKindInHkd(rows, 'revenue', empty)).toBeCloseTo(150.5);
    expect(sumTaxFiscalYearKindInHkd(rows, 'expense', empty)).toBeCloseTo(999);
  });

  it('converts foreign currency using HKD multipliers', () => {
    const rows: TaxFiscalYearRow[] = [
      row({ kind: 'revenue', amount: '10', currency: 'USD' }),
    ];
    const mult = new Map([['USD', 7.8]]);
    expect(sumTaxFiscalYearKindInHkd(rows, 'revenue', mult)).toBeCloseTo(78);
  });

  it('skips foreign rows when the multiplier is missing', () => {
    const rows: TaxFiscalYearRow[] = [
      row({ kind: 'expense', amount: '100', currency: 'USD' }),
    ];
    expect(sumTaxFiscalYearKindInHkd(rows, 'expense', new Map())).toBe(0);
  });
});
