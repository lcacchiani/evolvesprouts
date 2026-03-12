import { Suspense } from 'react';

import { MediaDownloadRedirectPage } from '@/components/pages/media-download-redirect';
import enContent from '@/content/en.json';

const defaultMediaDownloadContent = enContent.common.mediaDownload;

function DownloadPageFallback() {
  return (
    <main className='mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center'>
      <h1 className='text-3xl font-bold es-text-heading'>
        {defaultMediaDownloadContent.preparingTitle}
      </h1>
    </main>
  );
}

export default function MediaDownloadPage() {
  return (
    <Suspense fallback={<DownloadPageFallback />}>
      <MediaDownloadRedirectPage content={defaultMediaDownloadContent} />
    </Suspense>
  );
}
