import { getAdminDefaultCurrencyCode } from '@/lib/config';
import { CLIENT_DOCUMENT_ASSET_TAG, EXPENSE_ATTACHMENT_ASSET_TAG } from '@/types/assets';
import type { LocationSummary } from '@/types/services';

/** Short user-visible label for a location (venue name, address, or id). */
export function formatLocationLabel(location: LocationSummary): string {
  const name = location.name?.trim();
  if (name) {
    return name;
  }
  const address = location.address?.trim();
  if (address) {
    return address;
  }
  return location.id;
}

/** Full venue label: address (when present) plus geographic area name. */
export function formatCrmVenueLocationLabel(location: {
  name?: string | null;
  address?: string | null;
  areaName?: string | null;
  id: string;
}): string {
  const address = location.address?.trim();
  const area = location.areaName?.trim();
  const name = location.name?.trim();
  const parts: string[] = [];
  if (address) {
    parts.push(address);
  } else if (name) {
    parts.push(name);
  }
  if (area) {
    parts.push(area);
  }
  if (parts.length > 0) {
    return parts.join(' · ');
  }
  return location.id;
}

export function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** User-visible label for an asset tag name (API snake_case). */
export function formatAssetTagDisplayName(tagName: string): string {
  const lower = tagName.toLowerCase();
  if (lower === EXPENSE_ATTACHMENT_ASSET_TAG) {
    return 'Expense';
  }
  if (lower === CLIENT_DOCUMENT_ASSET_TAG) {
    return 'Client';
  }
  return toTitleCase(tagName.toLowerCase());
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
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DEFAULT_CURRENCY_LABEL_HKD = 'Hong Kong Dollar';

/** Fixed allowlist for admin currency dropdowns; default currency (env) is listed first. */
const ADMIN_SELECTABLE_CURRENCY_CODES = ['HKD', 'USD', 'EUR', 'CNY', 'SGD'] as const;

function getAdminSelectableCurrencyCodesOrdered(): string[] {
  const defaultCode = getAdminDefaultCurrencyCode();
  const inAllowlist = ADMIN_SELECTABLE_CURRENCY_CODES.includes(
    defaultCode as (typeof ADMIN_SELECTABLE_CURRENCY_CODES)[number]
  );
  if (inAllowlist) {
    return [defaultCode, ...ADMIN_SELECTABLE_CURRENCY_CODES.filter((c) => c !== defaultCode)];
  }
  return [defaultCode, ...ADMIN_SELECTABLE_CURRENCY_CODES];
}

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

  const options = getAdminSelectableCurrencyCodesOrdered().map((code) => {
    if (code === 'HKD') {
      return { value: code, label: `${code} ${DEFAULT_CURRENCY_LABEL_HKD}` };
    }
    return { value: code, label: `${code} ${getCurrencyName(code)}` };
  });

  cachedCurrencyOptions = options;
  return options;
}

/** BCP 47 tags for admin asset content language (matches public client-resources filter). */
export const ADMIN_ASSET_CONTENT_LANGUAGE_TAGS = ['en', 'zh-CN', 'zh-HK'] as const;

export type AdminSelectableContentLanguageTag = (typeof ADMIN_ASSET_CONTENT_LANGUAGE_TAGS)[number];

type ContentLanguageOption = {
  value: string;
  label: string;
};

let cachedContentLanguageOptions: ContentLanguageOption[] | null = null;

function getLanguageDisplayName(tag: string): string {
  if (typeof Intl.DisplayNames === 'undefined') {
    return tag;
  }
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return displayNames.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/**
 * Fixed allowlist for admin asset content-language dropdowns (ISO-style BCP 47 tags).
 * Same pattern as {@link getCurrencyOptions}.
 */
export function getContentLanguageOptions(): ContentLanguageOption[] {
  if (cachedContentLanguageOptions) {
    return cachedContentLanguageOptions;
  }

  const labels: Record<(typeof ADMIN_ASSET_CONTENT_LANGUAGE_TAGS)[number], string> = {
    en: 'English',
    'zh-CN': 'Mandarin (Simplified)',
    'zh-HK': 'Cantonese (Hong Kong)',
  };

  cachedContentLanguageOptions = ADMIN_ASSET_CONTENT_LANGUAGE_TAGS.map((tag) => ({
    value: tag,
    label: `${tag} ${labels[tag] ?? getLanguageDisplayName(tag)}`,
  }));
  return cachedContentLanguageOptions;
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

export function formatDateOnly(value: string | null): string {
  if (!value) {
    return '—';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return LOCAL_DATE_FORMATTER.format(parsedDate);
}

export function formatDateForInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}
