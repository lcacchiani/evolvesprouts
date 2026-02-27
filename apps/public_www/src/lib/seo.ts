import type { Metadata } from 'next';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/content';
import {
  localizePath as localizeLocalizedPath,
  normalizeLocalizedPath,
} from '@/lib/locale-routing';

const SITE_ORIGIN_ENV_NAME = 'NEXT_PUBLIC_SITE_ORIGIN';

export function normalizeSiteOrigin(rawOrigin: string): string {
  const normalizedOrigin = rawOrigin.trim();
  if (normalizedOrigin === '') {
    throw new Error(`${SITE_ORIGIN_ENV_NAME} must not be empty.`);
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(normalizedOrigin);
  } catch {
    throw new Error(`${SITE_ORIGIN_ENV_NAME} must be a valid absolute URL.`);
  }

  const protocol = parsedOrigin.protocol.toLowerCase();
  const hostname = parsedOrigin.hostname.toLowerCase();
  const isLocalhostHttpOrigin = protocol === 'http:' && hostname === 'localhost';
  if (protocol !== 'https:' && !isLocalhostHttpOrigin) {
    throw new Error(
      `${SITE_ORIGIN_ENV_NAME} must use https, or http://localhost for local development.`,
    );
  }

  if (parsedOrigin.pathname !== '/' || parsedOrigin.search !== '' || parsedOrigin.hash !== '') {
    throw new Error(
      `${SITE_ORIGIN_ENV_NAME} must not include a path, query string, or hash fragment.`,
    );
  }

  return parsedOrigin.origin;
}

function resolveSiteOrigin(): string {
  const configuredSiteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() ?? '';
  if (configuredSiteOrigin !== '') {
    return normalizeSiteOrigin(configuredSiteOrigin);
  }

  if (process.env.NODE_ENV === 'test') {
    const locationOrigin =
      typeof globalThis.location?.origin === 'string'
        ? globalThis.location.origin.trim()
        : '';
    if (locationOrigin !== '') {
      return normalizeSiteOrigin(locationOrigin);
    }
  }

  throw new Error(`Missing required environment variable: ${SITE_ORIGIN_ENV_NAME}`);
}

export const SITE_ORIGIN = resolveSiteOrigin();
export const SITE_HOST = new URL(SITE_ORIGIN).hostname;
export const DEFAULT_SOCIAL_IMAGE = '/images/seo/evolvesprouts-og-default.png';
const SITE_TITLE_SUFFIX = 'Evolve Sprouts';
const PAGE_TITLE_SEPARATOR = ' - ';

export function localizePath(path: string, locale: Locale): string {
  return localizeLocalizedPath(path, locale);
}

export function buildLocaleAlternates(path: string): Record<string, string> {
  const normalizedPath = normalizeLocalizedPath(path);
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      localizePath(normalizedPath, locale),
    ]),
  );

  return {
    ...languages,
    'x-default': localizePath(normalizedPath, DEFAULT_LOCALE),
  };
}

interface LocalizedMetadataOptions {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  socialImage?: {
    url: string;
    alt?: string;
  };
  robots?: {
    index: boolean;
    follow: boolean;
  };
}

function buildPageTitle(title: string, path: string): string {
  const normalizedTitle = title.trim();
  if (normalizedTitle === '') {
    return SITE_TITLE_SUFFIX;
  }

  if (normalizeLocalizedPath(path) === '/') {
    return normalizedTitle;
  }

  const fullSuffix = `${PAGE_TITLE_SEPARATOR}${SITE_TITLE_SUFFIX}`;
  if (normalizedTitle.endsWith(fullSuffix)) {
    return normalizedTitle;
  }

  return `${normalizedTitle}${fullSuffix}`;
}

export function buildLocalizedMetadata({
  locale,
  path,
  title,
  description,
  socialImage,
  robots,
}: LocalizedMetadataOptions): Metadata {
  const localizedPath = localizePath(path, locale);
  const pageTitle = buildPageTitle(title, path);
  const socialImageUrl = socialImage?.url || DEFAULT_SOCIAL_IMAGE;
  const socialImageAlt = socialImage?.alt || SITE_TITLE_SUFFIX;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: localizedPath,
      languages: buildLocaleAlternates(path),
    },
    openGraph: {
      title: pageTitle,
      description,
      url: localizedPath,
      siteName: SITE_TITLE_SUFFIX,
      type: 'website',
      locale,
      images: [
        {
          url: socialImageUrl,
          alt: socialImageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [socialImageUrl],
    },
    robots: {
      index: robots?.index ?? true,
      follow: robots?.follow ?? true,
    },
  };
}
