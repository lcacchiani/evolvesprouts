import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MediaDownloadRedirectPage } from '@/components/pages/media-download-redirect';
import {
  type LocaleRouteProps,
  resolveLocaleFromParams,
  resolveLocalePageContext,
} from '@/lib/locale-page';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({
  params,
}: LocaleRouteProps): Promise<Metadata> {
  await resolveLocaleFromParams(params);

  return {
    robots: {
      index: false,
      follow: false,
    },
  };
}

function LocalizedDownloadPageFallback({
  message,
}: {
  message: string;
}) {
  return (
    <main
      id='main-content'
      tabIndex={-1}
      className='mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center'
    >
      <div className='flex w-full max-w-lg flex-col items-center'>
        <div className='h-10 w-10 animate-spin rounded-full border-4 border-[color:var(--site-primary-soft,#EAD5C4)] border-t-[color:var(--site-primary,#D19253)]' />
        <div className='mt-6 w-full min-h-0 overflow-hidden rounded-inner border es-border-success es-bg-surface-success-pale p-4 text-left'>
          <p className='text-base leading-7 es-text-success'>{message}</p>
        </div>
      </div>
    </main>
  );
}

export default async function LocalizedMediaDownloadPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);
  const mediaDownloadContent = content.common.mediaDownload;

  return (
    <Suspense
      fallback={
        <LocalizedDownloadPageFallback message={mediaDownloadContent.preparingMessage} />
      }
    >
      <MediaDownloadRedirectPage content={mediaDownloadContent} />
    </Suspense>
  );
}
