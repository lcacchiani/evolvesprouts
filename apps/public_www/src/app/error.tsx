'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { getContent, type Locale } from '@/content';
import { getLocaleFromPath } from '@/lib/locale-routing';

interface RootErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const RETRY_LABELS: Record<Locale, string> = {
  en: 'Try again',
  'zh-CN': '重试',
  'zh-HK': '重試',
};

export default function RootErrorPage({ error, reset }: RootErrorPageProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname ?? '/');
  const content = getContent(locale);

  useEffect(() => {
    console.error(`[root-error-boundary:${locale}]`, error);
  }, [error, locale]);

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
        {RETRY_LABELS[locale]}
      </button>
    </main>
  );
}
