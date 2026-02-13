import { PageLayout } from '@/components/page-layout';
import { Whoops } from '@/components/sections/whoops';
import { DEFAULT_LOCALE, getContent } from '@/content';

const content = getContent(DEFAULT_LOCALE);

export default function NotFoundPage() {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
      mainClassName='mx-auto flex min-h-[58vh] w-full max-w-[1465px] items-center px-4 py-16 sm:px-6 lg:px-8'
    >
      <Whoops content={content.whoops} />
    </PageLayout>
  );
}
