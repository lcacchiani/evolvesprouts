import { Suspense } from 'react';

import { MediaDownloadRedirectPage } from '@/components/pages/media-download-redirect';
import { type LocaleRouteProps, resolveLocalePageContext } from '@/lib/locale-page';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

function LocalizedDownloadPageFallback({
  title,
}: {
  title: string;
}) {
  return (
    <main className='mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center'>
      <h1 className='text-3xl font-bold es-text-heading'>{title}</h1>
    </main>
  );
}

export default async function LocalizedMediaDownloadPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);
  const mediaDownloadContent = content.common.mediaDownload;

  return (
    <Suspense fallback={<LocalizedDownloadPageFallback title={mediaDownloadContent.preparingTitle} />}>
      <MediaDownloadRedirectPage content={mediaDownloadContent} />
    </Suspense>
  );
}
