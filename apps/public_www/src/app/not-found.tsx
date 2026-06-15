'use client';

import { useEffect, useState } from 'react';

import { PlaceholderPageLayout } from '@/components/shared/placeholder-page-layout';
import { Whoops } from '@/components/sections/whoops';
import { DEFAULT_LOCALE, getContent, isValidLocale, SUPPORTED_LOCALES, type Locale } from '@/content';

function resolveLocaleFromPathname(pathname: string): Locale | null {
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  if (firstSegment && isValidLocale(firstSegment)) {
    return firstSegment;
  }
  return null;
}

function resolveLocaleFromNavigator(): Locale | null {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const browserLocales = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const browserLocale of browserLocales) {
    const normalized = browserLocale.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    const exactMatch = SUPPORTED_LOCALES.find(
      (locale) => locale.toLowerCase() === normalized,
    );
    if (exactMatch) {
      return exactMatch;
    }

    const primary = normalized.split('-')[0];
    if (primary && isValidLocale(primary)) {
      return primary;
    }
  }

  return null;
}

function resolveNotFoundLocale(): Locale {
  if (typeof window !== 'undefined') {
    const fromPath = resolveLocaleFromPathname(window.location.pathname);
    if (fromPath) {
      return fromPath;
    }

    const fromNavigator = resolveLocaleFromNavigator();
    if (fromNavigator) {
      return fromNavigator;
    }
  }

  return DEFAULT_LOCALE;
}

export default function NotFoundPage() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  const content = getContent(locale);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- defer locale detection until after hydration
    setLocale(resolveNotFoundLocale());
  }, []);

  useEffect(() => {
    document.title = `${content.whoops.title} - ${content.navbar.brand}`;
  }, [content.navbar.brand, content.whoops.title]);

  return (
    <PlaceholderPageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <Whoops content={content.whoops} />
    </PlaceholderPageLayout>
  );
}
