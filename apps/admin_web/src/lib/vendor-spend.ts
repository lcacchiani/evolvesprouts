import { getAdminDefaultCurrencyCode } from '@/lib/config';
import { getCurrencyConversionMultiplier } from '@/lib/currency-converter';
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
 * Sums expense totals per vendor in the admin default display currency (see
 * NEXT_PUBLIC_ADMIN_DEFAULT_CURRENCY) using Frankfurter rates.
 * Expenses without a positive `total`, without `currency`, or voided are skipped.
 */
export async function computeVendorSpendInDefaultCurrencyByVendorId(
  expenses: Expense[]
): Promise<Map<string, number>> {
  const targetCurrency = getAdminDefaultCurrencyCode();
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
      const mult = await getCurrencyConversionMultiplier(code, targetCurrency);
      multipliers.set(code, mult);
    })
  );

  for (const { vendorId, amount, currency } of pending) {
    const mult = multipliers.get(currency) ?? 1;
    const converted = amount * mult;
    totals.set(vendorId, (totals.get(vendorId) ?? 0) + converted);
  }

  return totals;
}

/** Format a numeric amount using the admin default display currency. */
export function formatAmountInDefaultCurrency(value: number): string {
  const code = getAdminDefaultCurrencyCode();
  const locale = code === 'HKD' ? 'en-HK' : undefined;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
