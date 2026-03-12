import type { Metadata } from 'next';

import { PlaceholderPageLayout } from '@/components/shared/placeholder-page-layout';
import { Whoops } from '@/components/sections/whoops';
import enContent from '@/content/en.json';

const content = enContent;

export const metadata: Metadata = {
  title: `${content.whoops.title} - ${content.navbar.brand}`,
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
