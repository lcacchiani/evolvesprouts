import { FreeGuideDownloadRedirectPage } from '@/components/pages/free-guide-download-redirect';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export default function LocalizedGuideDownloadPage() {
  return <FreeGuideDownloadRedirectPage />;
}
