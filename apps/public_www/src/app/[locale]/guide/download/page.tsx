import { Suspense } from 'react';

import { FreeGuideDownloadRedirectPage } from '@/components/pages/free-guide-download-redirect';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

function LocalizedDownloadPageFallback() {
  return (
    <main className='mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center'>
      <h1 className='text-3xl font-bold es-text-heading'>Preparing your download...</h1>
    </main>
  );
}

export default function LocalizedGuideDownloadPage() {
  return (
    <Suspense fallback={<LocalizedDownloadPageFallback />}>
      <FreeGuideDownloadRedirectPage />
    </Suspense>
  );
}
