'use client';

import { useParams } from 'next/navigation';

import { ErrorPageContent } from '@/components/shared/error-page-content';
import { DEFAULT_LOCALE, getContent, isValidLocale, type Locale } from '@/content';

interface LocaleErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function resolveLocaleFromParams(params: { locale?: string }): Locale {
  if (params.locale && isValidLocale(params.locale)) {
    return params.locale;
  }

  return DEFAULT_LOCALE;
}

export default function LocaleErrorPage({ error, reset }: LocaleErrorPageProps) {
  const params = useParams<{ locale?: string }>();
  const locale = resolveLocaleFromParams(params);
  const content = getContent(locale);

  return (
    <ErrorPageContent
      locale={locale}
      content={content}
      error={error}
      reset={reset}
      reportingContext='locale-error-boundary'
    />
  );
}
