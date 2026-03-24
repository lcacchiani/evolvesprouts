import { getHkdMultiplier } from '@/lib/frankfurter-exchange';
import type { Expense } from '@/types/expenses';

function parsePositiveAmount(value: string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function expenseCountsTowardVendorSpend(expense: Expense): boolean {
  if (expense.status === 'voided') {
    return false;
  }
  const vendorId = expense.vendorId?.trim();
  return Boolean(vendorId);
}

/**
 * Sums expense totals per vendor in HKD using Frankfurter rates.
 * Expenses without a positive `total`, without `currency`, or voided are skipped.
 */
export async function computeVendorSpendHkdByVendorId(expenses: Expense[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  const pending: { vendorId: string; amount: number; currency: string }[] = [];

  for (const expense of expenses) {
    if (!expenseCountsTowardVendorSpend(expense)) {
      continue;
    }
    const vendorId = expense.vendorId!.trim();
    const amount = parsePositiveAmount(expense.total ?? null);
    const currency = expense.currency?.trim().toUpperCase();
    if (amount == null || !currency) {
      continue;
    }
    pending.push({ vendorId, amount, currency });
  }

  const uniqueCurrencies = Array.from(new Set(pending.map((p) => p.currency)));
  const multipliers = new Map<string, number>();
  await Promise.all(
    uniqueCurrencies.map(async (code) => {
      const mult = await getHkdMultiplier(code);
      multipliers.set(code, mult);
    })
  );

  for (const { vendorId, amount, currency } of pending) {
    const mult = multipliers.get(currency) ?? 1;
    const hkd = amount * mult;
    totals.set(vendorId, (totals.get(vendorId) ?? 0) + hkd);
  }

  return totals;
}

export function formatHkdAmount(value: number): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: 'HKD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
