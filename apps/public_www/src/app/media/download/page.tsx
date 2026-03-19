import type { Metadata } from 'next';

import { createDefaultLocaleRedirectPage } from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default createDefaultLocaleRedirectPage(ROUTES.mediaDownload);
