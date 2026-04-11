import { createNoIndexDefaultLocaleRedirectPage } from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';

const noIndexMediaDownloadRedirect = createNoIndexDefaultLocaleRedirectPage(
  ROUTES.mediaDownload,
);

export const metadata = noIndexMediaDownloadRedirect.metadata;
export default noIndexMediaDownloadRedirect.default;
