import { PageLayout } from '@/components/page-layout';
import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  createPlaceholderPage,
  generateLocaleStaticParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
} from '@/lib/locale-page';

const TERMS_PLACEHOLDER_OPTIONS = {
  path: '/terms',
  fallbackTitle: 'Terms & Conditions',
  labelResolver: getFooterLinkLabel,
} as const;
const termsPlaceholderPage = createPlaceholderPage(TERMS_PLACEHOLDER_OPTIONS);

export { generateLocaleStaticParams as generateStaticParams };

export async function generateMetadata({ params }: LocaleRouteProps) {
  return termsPlaceholderPage.generateMetadata({ params });
}

export default async function TermsPage({ params }: LocaleRouteProps) {
  const { content, title } = await termsPlaceholderPage.resolveProps(params);

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
