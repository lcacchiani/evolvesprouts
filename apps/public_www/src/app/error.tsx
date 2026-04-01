'use client';

import { usePathname } from 'next/navigation';

import { ErrorPageContent } from '@/components/shared/error-page-content';
import { getContent } from '@/content';
import { getLocaleFromPath } from '@/lib/locale-routing';

interface RootErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootErrorPage({ error, reset }: RootErrorPageProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname ?? '/');
  const content = getContent(locale);

  return (
    <ErrorPageContent
      locale={locale}
      content={content}
      error={error}
      reset={reset}
      reportingContext='root-error-boundary'
    />
  );
}
