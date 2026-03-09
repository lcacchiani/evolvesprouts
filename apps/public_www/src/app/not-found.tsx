import type { Metadata } from 'next';

import { PlaceholderPageLayout } from '@/components/shared/placeholder-page-layout';
import { Whoops } from '@/components/sections/whoops';
import { DEFAULT_LOCALE, getContent } from '@/content';
import { SITE_TITLE_SUFFIX } from '@/lib/seo';

const content = getContent(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: `Page Not Found - ${SITE_TITLE_SUFFIX}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFoundPage() {
  return (
    <PlaceholderPageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <Whoops content={content.whoops} />
    </PlaceholderPageLayout>
  );
}
