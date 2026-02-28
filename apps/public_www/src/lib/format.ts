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
