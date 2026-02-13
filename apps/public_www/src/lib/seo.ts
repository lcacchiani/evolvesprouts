import type { Metadata } from 'next';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/content';

export const SITE_ORIGIN = 'https://www.evolvesprouts.com';
const SITE_TITLE_SUFFIX = 'Evolve Sprouts';
const PAGE_TITLE_SEPARATOR = ' - ';

function normalizeBasePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '' || trimmed === '/') {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/')
    ? trimmed
    : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

export function localizePath(path: string, locale: Locale): string {
  const basePath = normalizeBasePath(path);
  if (basePath === '/') {
    return `/${locale}`;
  }

  return `/${locale}${basePath}`;
}

export function buildLocaleAlternates(path: string): Record<string, string> {
  const normalizedPath = normalizeBasePath(path);
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
}

function buildPageTitle(title: string, path: string): string {
  const normalizedTitle = title.trim();
  if (normalizedTitle === '') {
    return SITE_TITLE_SUFFIX;
  }

  if (normalizeBasePath(path) === '/') {
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
}: LocalizedMetadataOptions): Metadata {
  return {
    title: buildPageTitle(title, path),
    description,
    alternates: {
      canonical: localizePath(path, locale),
      languages: buildLocaleAlternates(path),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
