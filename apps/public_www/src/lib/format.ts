import type { Locale } from '@/content';

import { formatCohortMonthYearLabel } from '@/lib/site-datetime';

const DEFAULT_HKD_LOCALE = 'en-HK';
const HKD_CURRENCY = 'HKD';
const formatterCache = new Map<string, Intl.NumberFormat>();

const COHORT_MONTH_ABBREV_TO_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const COHORT_NUMERIC_PATTERN = /^(\d{2})-(\d{2})$/;
const COHORT_ALPHA_PATTERN = /^([A-Za-z]{3})-(\d{2})$/;

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

/**
 * Broad cohort token shape: three letters or two digits, hyphen, two-digit year suffix.
 * Month validity is enforced in {@link parseCohortValue} (invalid month abbreviations parse to null).
 */
export const COHORT_VALUE_PATTERN = /^(?:[A-Za-z]{3}|\d{2})-\d{2}$/;

/**
 * Parses a cohort string from the public calendar API.
 *
 * Accepted forms:
 * - Legacy numeric month: `04-26` → April 2026 (month must be 01–12).
 * - Canonical English month abbreviations (case-insensitive): `apr-26`, `APR-26` → April 2026.
 *   Only three-letter English abbreviations matching `Intl.DateTimeFormat({ month: 'short' })`
 *   in English locales are accepted (`jan`–`dec`). Full month names (`april-26`) and four-letter
 *   `sept` are not accepted; if the API emits those later, widen the parser accordingly.
 */
export function parseCohortValue(
  value: string,
): { monthIndex: number; year: number } | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const alphaMatch = COHORT_ALPHA_PATTERN.exec(trimmedValue);
  if (alphaMatch) {
    const monthKey = alphaMatch[1].toLowerCase();
    const monthIndex = COHORT_MONTH_ABBREV_TO_INDEX[monthKey];
    if (monthIndex === undefined) {
      return null;
    }
    const yearSuffix = Number.parseInt(alphaMatch[2], 10);
    if (!Number.isInteger(yearSuffix)) {
      return null;
    }
    return { monthIndex, year: 2000 + yearSuffix };
  }

  const numericMatch = COHORT_NUMERIC_PATTERN.exec(trimmedValue);
  if (!numericMatch) {
    return null;
  }

  const monthNumber = Number.parseInt(numericMatch[1], 10);
  const yearSuffix = Number.parseInt(numericMatch[2], 10);
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
