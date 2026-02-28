'use client';

import { useEffect } from 'react';

import { DEFAULT_LOCALE, getContent } from '@/content';

interface RootErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const content = getContent(DEFAULT_LOCALE);

export default function RootErrorPage({ error, reset }: RootErrorPageProps) {
  useEffect(() => {
    console.error('[root-error-boundary]', error);
  }, [error]);

  return (
    <main className='mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 py-16 text-center'>
      <h1 className='text-3xl font-semibold es-text-heading'>{content.whoops.title}</h1>
      <p className='max-w-xl text-base leading-7 es-text-body'>
        {content.whoops.description}
      </p>
      <button
        type='button'
        onClick={reset}
        className='es-focus-ring mt-2 inline-flex min-h-11 items-center justify-center rounded-control px-6 py-2 text-base font-semibold es-btn es-btn--primary'
      >
        Try again
      </button>
    </main>
  );
}
