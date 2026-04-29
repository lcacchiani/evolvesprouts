const MBA_PATH = '/services/my-best-auntie-training-course';

/** Allowed locale segments for referral URLs (must match public site). */
export const MY_BEST_AUNTIE_REFERRAL_LOCALES = ['en', 'zh-CN', 'zh-HK'] as const;
export type MyBestAuntieReferralLocale = (typeof MY_BEST_AUNTIE_REFERRAL_LOCALES)[number];

/** Human-readable labels for the referral QR locale selector (values stay `en` / `zh-CN` / `zh-HK`). */
export const REFERRAL_LOCALE_DISPLAY_LABELS: Record<MyBestAuntieReferralLocale, string> = {
  en: 'English',
  'zh-CN': 'Chinese Simplified',
  'zh-HK': 'Chinese Traditional',
};

export type ReferralParamName = 'ref' | 'discount';

export interface BuildMyBestAuntieReferralUrlInput {
  baseUrl: string;
  locale: string;
  code: string;
  paramName: ReferralParamName;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Resolves a locale string to a supported public-site locale, or empty when unsupported. */
export function normalizePublicSiteLocale(locale: string): MyBestAuntieReferralLocale | '' {
  const trimmed = locale.trim();
  if (!trimmed) {
    return 'en';
  }
  if ((MY_BEST_AUNTIE_REFERRAL_LOCALES as readonly string[]).includes(trimmed)) {
    return trimmed as MyBestAuntieReferralLocale;
  }
  return '';
}

/**
 * Build a locale-prefixed My Best Auntie course URL with a referral query param.
 * Always includes the locale prefix segment for deterministic QR payloads.
 * Returns empty string when locale is not in the allowed set or base URL is blank.
 */
const SERVICE_KEY_PATH_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface BuildPublicReferralUrlInput {
  baseUrl: string;
  locale: string;
  /** Public `services.service_key` segment, or null/empty for locale home (`/{locale}/`). */
  serviceKey: string | null | undefined;
  code: string;
  paramName: ReferralParamName;
}

/**
 * Build a locale-prefixed public URL with `ref` or `discount` for referral QR.
 * With a service key: `/{locale}/services/{key}?…`. Without: `/{locale}/?…` (site home for that locale).
 *
 * Note: `URL` omits a trailing slash on non-root paths before the query string (for example
 * `…/services/foo?ref=…`), while marketing page QR uses a trailing slash before any query
 * (`buildLocalizedPublicPageUrl` / static export). Encoded payloads differ in shape by design.
 */
export function buildPublicReferralUrlWithSlug(input: BuildPublicReferralUrlInput): string {
  const base = trimTrailingSlashes(input.baseUrl.trim());
  if (!base) {
    return '';
  }
  const locale = normalizePublicSiteLocale(input.locale);
  if (!locale) {
    return '';
  }
  const code = input.code.trim().toUpperCase();
  if (!code) {
    return '';
  }
  const param = input.paramName === 'discount' ? 'discount' : 'ref';
  const rawKey = input.serviceKey?.trim().toLowerCase() ?? '';
  const path =
    rawKey && SERVICE_KEY_PATH_SEGMENT.test(rawKey)
      ? `/${locale}/services/${rawKey}`
      : `/${locale}/`;
  const url = new URL(path, `${base}/`);
  url.searchParams.set(param, code);
  return url.toString();
}

export function buildMyBestAuntieReferralUrl(input: BuildMyBestAuntieReferralUrlInput): string {
  const base = trimTrailingSlashes(input.baseUrl.trim());
  if (!base) {
    return '';
  }
  const locale = normalizePublicSiteLocale(input.locale);
  if (!locale) {
    return '';
  }
  const code = input.code.trim().toUpperCase();
  if (!code) {
    return '';
  }
  const param = input.paramName === 'discount' ? 'discount' : 'ref';
  const path = `/${locale}${MBA_PATH}`;
  const url = new URL(path, `${base}/`);
  url.searchParams.set(param, code);
  return url.toString();
}
