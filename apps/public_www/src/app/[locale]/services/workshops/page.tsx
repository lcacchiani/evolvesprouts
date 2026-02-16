import { PageLayout } from '@/components/page-layout';
import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  createPlaceholderPage,
  generateLocaleStaticParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
} from '@/lib/locale-page';

const WORKSHOPS_PLACEHOLDER_OPTIONS = {
  path: '/services/workshops',
  fallbackTitle: 'Workshops',
  labelResolver: getFooterLinkLabel,
} as const;
const workshopsPlaceholderPage = createPlaceholderPage(
  WORKSHOPS_PLACEHOLDER_OPTIONS,
);

export { generateLocaleStaticParams as generateStaticParams };

export async function generateMetadata({ params }: LocaleRouteProps) {
  return workshopsPlaceholderPage.generateMetadata({ params });
}

export default async function WorkshopsPage({ params }: LocaleRouteProps) {
  const { content, title } = await workshopsPlaceholderPage.resolveProps(params);

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
      mainClassName='mx-auto flex min-h-[52vh] w-full max-w-[1465px] items-center px-4 py-16 sm:px-6 lg:px-8'
    >
      <EmptyPagePlaceholder title={title} />
    </PageLayout>
  );
}
