import type { TaxFiscalYearRow } from '@/lib/tax-fiscal-year-report';
import { parseMoneyAmountString } from '@/lib/vendor-spend';

const HKD = 'HKD';

export function sumTaxFiscalYearKindInHkd(
  rows: TaxFiscalYearRow[],
  kind: 'revenue' | 'expense',
  hkdMultipliersFromCurrency: Map<string, number>,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.kind !== kind) {
      continue;
    }
    const amt = parseMoneyAmountString(row.amount);
    if (amt == null) {
      continue;
    }
    const cur = row.currency?.trim().toUpperCase() || HKD;
    if (cur === HKD) {
      total += amt;
      continue;
    }
    const mult = hkdMultipliersFromCurrency.get(cur);
    if (mult == null) {
      continue;
    }
    total += amt * mult;
  }
  return total;
}
