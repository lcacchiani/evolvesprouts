'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { getContent } from '@/content';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { reportInternalError } from '@/lib/internal-error-reporting';
import { getLocaleFromPath } from '@/lib/locale-routing';

interface RootErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootErrorPage({ error, reset }: RootErrorPageProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname ?? '/');
  const content = getContent(locale);

  useEffect(() => {
    reportInternalError({
      context: 'root-error-boundary',
      error,
      metadata: { locale },
    });
  }, [error, locale]);

  return (
    <main className='mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 py-16 text-center'>
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
