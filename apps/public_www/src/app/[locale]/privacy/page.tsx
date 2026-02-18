import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import { PlaceholderPageLayout } from '@/components/placeholder-page-layout';
import {
  createPlaceholderPage,
  generateLocaleStaticParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
} from '@/lib/locale-page';

const PRIVACY_PLACEHOLDER_OPTIONS = {
  path: '/privacy',
  fallbackTitle: 'Privacy Policy',
  labelResolver: getFooterLinkLabel,
} as const;
const privacyPlaceholderPage = createPlaceholderPage(PRIVACY_PLACEHOLDER_OPTIONS);

export { generateLocaleStaticParams as generateStaticParams };

export async function generateMetadata({ params }: LocaleRouteProps) {
  return privacyPlaceholderPage.generateMetadata({ params });
}

export default async function PrivacyPage({ params }: LocaleRouteProps) {
  const { content, title } = await privacyPlaceholderPage.resolveProps(params);

  return (
    <PlaceholderPageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <EmptyPagePlaceholder title={title} />
    </PlaceholderPageLayout>
  );
}
