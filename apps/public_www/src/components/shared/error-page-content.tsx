'use client';

import { useEffect } from 'react';

import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import type { Locale, SiteContent } from '@/content';
import { reportInternalError } from '@/lib/internal-error-reporting';

export type ErrorPageReportingContext =
  | 'root-error-boundary'
  | 'locale-error-boundary';

interface ErrorPageContentProps {
  locale: Locale;
  content: SiteContent;
  error: Error & { digest?: string };
  reset: () => void;
  reportingContext: ErrorPageReportingContext;
}

export function ErrorPageContent({
  locale,
  content,
  error,
  reset,
  reportingContext,
}: ErrorPageContentProps) {
  useEffect(() => {
    reportInternalError({
      context: reportingContext,
      error,
      metadata: { locale },
    });
  }, [error, locale, reportingContext]);

  return (
    <main
      id='main-content'
      tabIndex={-1}
      className='mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center'
    >
      <h1 className='text-3xl font-semibold es-text-heading'>{content.whoops.title}</h1>
      <p className='max-w-xl text-base leading-7 es-text-body'>
        {renderQuotedDescriptionText(content.whoops.description)}
      </p>
      <button
        type='button'
        onClick={reset}
        className='es-focus-ring mt-2 inline-flex min-h-11 items-center justify-center rounded-control px-6 py-2 text-base font-semibold es-btn es-btn--primary'
      >
        {content.whoops.retryLabel}
      </button>
    </main>
  );
}
