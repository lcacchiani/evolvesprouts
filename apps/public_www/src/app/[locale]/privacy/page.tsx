import { EmptyPagePlaceholder } from '@/components/pages/empty-page-placeholder';
import { PlaceholderPageLayout } from '@/components/shared/placeholder-page-layout';
import {
  createPlaceholderPage,
  generateLocaleStaticParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';

const PRIVACY_PLACEHOLDER_OPTIONS = {
  path: ROUTES.privacy,
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
