import { PlaceholderPageLayout } from '@/components/placeholder-page-layout';
import { Whoops } from '@/components/sections/whoops';
import { DEFAULT_LOCALE, getContent } from '@/content';

const content = getContent(DEFAULT_LOCALE);

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
