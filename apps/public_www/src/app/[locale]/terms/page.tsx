import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import { PlaceholderPageLayout } from '@/components/placeholder-page-layout';
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
    <PlaceholderPageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <EmptyPagePlaceholder title={title} />
    </PlaceholderPageLayout>
  );
}
