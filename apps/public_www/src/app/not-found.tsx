import type { Metadata } from 'next';

import { PlaceholderPageLayout } from '@/components/shared/placeholder-page-layout';
import { Whoops } from '@/components/sections/whoops';
import { DEFAULT_LOCALE, getContent } from '@/content';

const content = getContent(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: 'Page Not Found - Evolve Sprouts',
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
