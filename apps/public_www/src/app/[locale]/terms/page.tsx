import { PageLayout } from '@/components/page-layout';
import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderMetadataFromParams,
  generateLocaleStaticParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';

const TERMS_PLACEHOLDER_OPTIONS = {
  path: '/terms',
  fallbackTitle: 'Terms & Conditions',
  labelResolver: getFooterLinkLabel,
} as const;

export { generateLocaleStaticParams as generateStaticParams };

export async function generateMetadata({ params }: LocaleRouteProps) {
  return buildPlaceholderMetadataFromParams(params, TERMS_PLACEHOLDER_OPTIONS);
}

export default async function TermsPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(
    content,
    TERMS_PLACEHOLDER_OPTIONS.path,
    TERMS_PLACEHOLDER_OPTIONS.fallbackTitle,
  );

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
