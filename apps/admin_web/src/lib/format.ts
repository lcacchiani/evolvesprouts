export function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Same date/time field choices as the app shell navbar timestamp (local TZ + default locale). */
export const NAVBAR_LOCAL_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const LOCAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  ...NAVBAR_LOCAL_DATETIME_OPTIONS,
  year: 'numeric',
});

const DEFAULT_CURRENCY = 'HKD';
const DEFAULT_CURRENCY_LABEL = 'Hong Kong Dollar';

type CurrencyOption = {
  value: string;
  label: string;
};

let cachedCurrencyOptions: CurrencyOption[] | null = null;

function getCurrencyName(code: string): string {
  if (typeof Intl.DisplayNames === 'undefined') {
    return code;
  }

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatEnumLabel(value: string): string {
  return toTitleCase(value.toLowerCase());
}

export function getCurrencyOptions(): CurrencyOption[] {
  if (cachedCurrencyOptions) {
    return cachedCurrencyOptions;
  }

  const intlWithSupportedValues = globalThis.Intl as unknown as {
    supportedValuesOf?: (key: 'currency') => string[];
  };
  const currencyCodes =
    intlWithSupportedValues.supportedValuesOf?.('currency')?.map((entry) => entry.toUpperCase()) ??
    [DEFAULT_CURRENCY];

  const dedupedCodes = Array.from(new Set([DEFAULT_CURRENCY, ...currencyCodes])).sort();
  const options = dedupedCodes.map((code) => {
    if (code === DEFAULT_CURRENCY) {
      return { value: code, label: `${code} ${DEFAULT_CURRENCY_LABEL}` };
    }
    return { value: code, label: `${code} ${getCurrencyName(code)}` };
  });

  cachedCurrencyOptions = options;
  return options;
}

export function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return LOCAL_DATE_TIME_FORMATTER.format(parsedDate);
}

export function formatDateForInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}
