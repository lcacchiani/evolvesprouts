const MBA_PATH = '/services/my-best-auntie-training-course';

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

function normalizeLocaleSegment(locale: string): string {
  const trimmed = locale.trim();
  if (!trimmed) {
    return 'en';
  }
  return trimmed;
}

/**
 * Build a locale-prefixed My Best Auntie course URL with a referral query param.
 * Always includes the locale prefix segment for deterministic QR payloads.
 */
export function buildMyBestAuntieReferralUrl(input: BuildMyBestAuntieReferralUrlInput): string {
  const base = trimTrailingSlashes(input.baseUrl.trim());
  const locale = normalizeLocaleSegment(input.locale);
  const code = input.code.trim().toUpperCase();
  const param = input.paramName === 'discount' ? 'discount' : 'ref';
  const path = `/${locale}${MBA_PATH}`;
  const url = new URL(path, `${base}/`);
  url.searchParams.set(param, code);
  return url.toString();
}
