import type { Locale } from '@/content';

import { formatCohortMonthYearLabel } from '@/lib/site-datetime';

const DEFAULT_HKD_LOCALE = 'en-HK';
const HKD_CURRENCY = 'HKD';
const formatterCache = new Map<string, Intl.NumberFormat>();

function normalizeLocale(locale?: string): string {
  const trimmedLocale = locale?.trim();
  if (!trimmedLocale) {
    return DEFAULT_HKD_LOCALE;
  }

  if (trimmedLocale === 'en') {
    return DEFAULT_HKD_LOCALE;
  }

  return trimmedLocale;
}

function getFormatter(locale?: string): Intl.NumberFormat {
  const normalizedLocale = normalizeLocale(locale);
  const cachedFormatter = formatterCache.get(normalizedLocale);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const nextFormatter = new Intl.NumberFormat(normalizedLocale, {
    style: 'currency',
    currency: HKD_CURRENCY,
    maximumFractionDigits: 0,
  });
  formatterCache.set(normalizedLocale, nextFormatter);
  return nextFormatter;
}

export function formatCurrencyHkd(value: number, locale?: string): string {
  try {
    return getFormatter(locale).format(value);
  } catch {
    return getFormatter(DEFAULT_HKD_LOCALE).format(value);
  }
}

export const COHORT_VALUE_PATTERN = /^(\d{2})-(\d{2})$/;

export function parseCohortValue(
  value: string,
): { monthIndex: number; year: number } | null {
  const trimmedValue = value.trim();
  const match = COHORT_VALUE_PATTERN.exec(trimmedValue);
  if (!match) {
    return null;
  }

  const monthNumber = Number(match[1]);
  const yearSuffix = Number(match[2]);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  if (!Number.isInteger(yearSuffix)) {
    return null;
  }

  return {
    monthIndex: monthNumber - 1,
    year: 2000 + yearSuffix,
  };
}

export function formatCohortValue(value: string, locale: Locale = 'en'): string {
  const parsed = parseCohortValue(value);
  if (!parsed) {
    return value;
  }

  return formatCohortMonthYearLabel(parsed.year, parsed.monthIndex, locale);
}

export { formatPartDateTimeLabel } from '@/lib/site-datetime';
