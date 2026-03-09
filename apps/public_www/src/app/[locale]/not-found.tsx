'use client';

import { useParams } from 'next/navigation';

import { PlaceholderPageLayout } from '@/components/shared/placeholder-page-layout';
import { Whoops } from '@/components/sections/whoops';
import { DEFAULT_LOCALE, getContent, isValidLocale, type Locale } from '@/content';

function resolveLocaleFromParams(params: { locale?: string }): Locale {
  if (params.locale && isValidLocale(params.locale)) {
    return params.locale;
  }

  return DEFAULT_LOCALE;
}

export default function LocalizedNotFoundPage() {
  const params = useParams<{ locale?: string }>();
  const locale = resolveLocaleFromParams(params);
  const content = getContent(locale);

  return (
    <PlaceholderPageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <Whoops content={content.whoops} />
    </PlaceholderPageLayout>
  );
}
