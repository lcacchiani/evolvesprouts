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

export const SITE_ORIGIN = 'https://www.evolvesprouts.com';
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
