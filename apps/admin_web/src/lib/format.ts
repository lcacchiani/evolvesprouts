import { getAdminDefaultCurrencyCode } from '@/lib/config';
import { CLIENT_DOCUMENT_ASSET_TAG, EXPENSE_ATTACHMENT_ASSET_TAG } from '@/types/assets';
import type { LocationSummary } from '@/types/services';

import adminSelectableCurrency from '@shared-config/admin-selectable-currency-codes.json';

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

const ADMIN_SELECTABLE_CURRENCY_CODES = adminSelectableCurrency.codes as readonly string[];

function getAdminSelectableCurrencyCodesOrdered(): string[] {
  const defaultCode = getAdminDefaultCurrencyCode();
  const inAllowlist = ADMIN_SELECTABLE_CURRENCY_CODES.includes(defaultCode);
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

/** BCP 47 tags for admin asset content language (matches admin API allowlist). */
export const ADMIN_ASSET_CONTENT_LANGUAGE_TAGS = ['en', 'zh-CN', 'zh-HK'] as const;

const ADMIN_ASSET_CONTENT_LANGUAGE_LABELS: Record<
  (typeof ADMIN_ASSET_CONTENT_LANGUAGE_TAGS)[number],
  string
> = {
  en: 'English',
  'zh-CN': 'Mandarin (Simplified)',
  'zh-HK': 'Cantonese (Hong Kong)',
};

type ContentLanguageOption = {
  value: string;
  label: string;
};

/**
 * Fixed allowlist for admin asset content-language dropdowns (ISO-style BCP 47 tags).
 * Same pattern as {@link getCurrencyOptions} (no module cache — avoids brittle test state).
 */
export function getContentLanguageOptions(): ContentLanguageOption[] {
  return ADMIN_ASSET_CONTENT_LANGUAGE_TAGS.map((tag) => ({
    value: tag,
    label: `${tag} ${ADMIN_ASSET_CONTENT_LANGUAGE_LABELS[tag]}`,
  }));
}

/**
 * Match stored API `content_language` to the admin allowlist, or detect unsupported values.
 */
export function matchAdminSelectableContentLanguage(
  value: string | null | undefined
): (typeof ADMIN_ASSET_CONTENT_LANGUAGE_TAGS)[number] | null | 'unrecognized' {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();
  for (const tag of ADMIN_ASSET_CONTENT_LANGUAGE_TAGS) {
    if (tag.toLowerCase() === lower) {
      return tag;
    }
  }
  return 'unrecognized';
}

/** User-visible label for an asset's stored content_language tag, or raw tag / em dash. */
export function formatAssetContentLanguageLabel(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    return '—';
  }
  const lower = raw.toLowerCase();
  for (const tag of ADMIN_ASSET_CONTENT_LANGUAGE_TAGS) {
    if (tag.toLowerCase() === lower) {
      return `${tag} ${ADMIN_ASSET_CONTENT_LANGUAGE_LABELS[tag]}`;
    }
  }
  return raw;
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

/** Map API ISO instant to `datetime-local` value in the browser's local timezone. */
export function formatIsoForDatetimeLocalInput(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** Parse `datetime-local` string as local wall time and return UTC ISO for the API. */
export function parseDatetimeLocalToIsoUtc(local: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}
