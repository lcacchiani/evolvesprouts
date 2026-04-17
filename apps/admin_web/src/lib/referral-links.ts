const MBA_PATH = '/services/my-best-auntie-training-course';

/** Allowed locale segments for referral URLs (must match public site). */
export const MY_BEST_AUNTIE_REFERRAL_LOCALES = ['en', 'zh-CN', 'zh-HK'] as const;
export type MyBestAuntieReferralLocale = (typeof MY_BEST_AUNTIE_REFERRAL_LOCALES)[number];

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

function normalizeLocaleSegment(locale: string): MyBestAuntieReferralLocale | '' {
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
export function buildMyBestAuntieReferralUrl(input: BuildMyBestAuntieReferralUrlInput): string {
  const base = trimTrailingSlashes(input.baseUrl.trim());
  if (!base) {
    return '';
  }
  const locale = normalizeLocaleSegment(input.locale);
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
