import type { TaxFiscalYearRow } from '@/lib/tax-fiscal-year-report';
import { parseMoneyAmountString } from '@/lib/vendor-spend';

export interface SumTaxFiscalYearKindResult {
  total: number;
  /** ISO codes for foreign rows whose multiplier was missing (excluded from {@link total}). */
  skippedForeignCurrencies: string[];
}

/**
 * Sums row amounts for one line kind, converting into {@link targetCurrencyCode} using
 * {@link multipliersToTarget} (from-currency → target). Rows in the target currency add directly;
 * other currencies require a map entry or they are counted as skipped (not silently folded in).
 */
export function sumTaxFiscalYearKindWithFxCoverage(
  rows: TaxFiscalYearRow[],
  kind: 'revenue' | 'expense',
  multipliersToTarget: Map<string, number>,
  targetCurrencyCode: string,
): SumTaxFiscalYearKindResult {
  const target = targetCurrencyCode.trim().toUpperCase();
  const skipped = new Set<string>();
  let total = 0;
  for (const row of rows) {
    if (row.kind !== kind) {
      continue;
    }
    const amt = parseMoneyAmountString(row.amount);
    if (amt == null) {
      continue;
    }
    const cur = row.currency?.trim().toUpperCase() || target;
    if (cur === target) {
      total += amt;
      continue;
    }
    const mult = multipliersToTarget.get(cur);
    if (mult == null) {
      skipped.add(cur);
      continue;
    }
    total += amt * mult;
  }
  return { total, skippedForeignCurrencies: Array.from(skipped).sort() };
}
