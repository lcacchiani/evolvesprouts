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

const CURRENCY_AMOUNT_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  style: 'currency',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/**
 * Format a numeric amount as currency (symbol + grouped integer part + two fraction digits).
 * HKD uses `en-HK` like the Vendors "Total spend" column; other ISO 4217 codes use `en-GB`
 * so USD is shown as `US$` rather than ambiguous `$` under default locale.
 */
export function formatAmountInCurrency(value: number, currencyCode: string): string {
  const code = currencyCode.trim().toUpperCase();
  const locale = code === 'HKD' ? 'en-HK' : 'en-GB';
  return new Intl.NumberFormat(locale, {
    ...CURRENCY_AMOUNT_FORMAT_OPTIONS,
    currency: code,
  }).format(value);
}

/** Format a numeric amount using the admin default display currency. */
export function formatAmountInDefaultCurrency(value: number): string {
  return formatAmountInCurrency(value, getAdminDefaultCurrencyCode());
}
