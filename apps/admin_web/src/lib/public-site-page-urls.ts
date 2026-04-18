import { normalizePublicSiteLocale, type MyBestAuntieReferralLocale } from '@/lib/referral-links';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

const PATH_SEGMENT = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;

export interface NormalizePublicSitePathResult {
  /** Normalized path starting with `/`, ending with `/`, or `/` for site home. */
  path: string;
  error: string;
}

/**
 * Parses a public-site path for QR targets: relative path only, no query or hash,
 * no `..`, segments are lowercase kebab-safe (letters, numbers, hyphens).
 */
export function normalizePublicSitePathInput(raw: string): NormalizePublicSitePathResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { path: '/', error: '' };
  }
  if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return { path: '', error: 'Path cannot contain ".." or invalid characters.' };
  }
  if (trimmed.includes('?') || trimmed.includes('#')) {
    return { path: '', error: 'Remove query strings and fragments; use the path only.' };
  }
  let pathPart = trimmed.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pathPart) || pathPart.startsWith('//')) {
    return { path: '', error: 'Enter a path only (not a full URL).' };
  }
  if (!pathPart.startsWith('/')) {
    pathPart = `/${pathPart}`;
  }
  const segments = pathPart.split('/').filter((s) => s.length > 0);
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (segment !== lower) {
      return { path: '', error: 'Use lowercase letters in path segments.' };
    }
    if (!PATH_SEGMENT.test(segment)) {
      return {
        path: '',
        error: 'Each path segment may use letters, numbers, and hyphens only.',
      };
    }
  }
  const joined = segments.length === 0 ? '/' : `/${segments.join('/')}/`;
  return { path: joined, error: '' };
}

export interface BuildLocalizedPublicPageUrlInput {
  baseUrl: string;
  locale: string;
  /** Normalized path from `normalizePublicSitePathInput` (`/` or `/about-us/`). */
  path: string;
}

/**
 * Builds an absolute URL to a locale-prefixed public page. Paths use a trailing slash
 * to match the static-export site (`next.config` trailingSlash).
 */
export function buildLocalizedPublicPageUrl(input: BuildLocalizedPublicPageUrlInput): string {
  const base = trimTrailingSlashes(input.baseUrl.trim());
  if (!base) {
    return '';
  }
  const locale = normalizePublicSiteLocale(input.locale) as MyBestAuntieReferralLocale | '';
  if (!locale) {
    return '';
  }
  const path = input.path.trim();
  if (!path.startsWith('/')) {
    return '';
  }
  const suffix = path === '/' ? '' : path.replace(/^\/+|\/+$/g, '');
  const pathWithLocale =
    suffix.length === 0 ? `/${locale}/` : `/${locale}/${suffix}/`;
  const url = new URL(pathWithLocale, `${base}/`);
  return url.toString();
}
