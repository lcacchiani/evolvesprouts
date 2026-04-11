import { EmptyPagePlaceholder } from '@/components/pages/empty-page-placeholder';
import { PlaceholderPageLayout } from '@/components/shared/placeholder-page-layout';
import {
  createPlaceholderPage,
  generateLocaleStaticParams,
  getFooterLinkLabel,
  type LocaleRouteProps,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';

const SERVICES_HUB_PLACEHOLDER_OPTIONS = {
  path: ROUTES.servicesIndex,
  fallbackTitle: (content: Parameters<typeof getFooterLinkLabel>[0]) =>
    content.footer.services.title,
  labelResolver: getFooterLinkLabel,
} as const;
const servicesHubPlaceholderPage = createPlaceholderPage(
  SERVICES_HUB_PLACEHOLDER_OPTIONS,
);

export { generateLocaleStaticParams as generateStaticParams };

export async function generateMetadata({ params }: LocaleRouteProps) {
  return servicesHubPlaceholderPage.generateMetadata({ params });
}

export default async function ServicesHubPage({ params }: LocaleRouteProps) {
  const { content, title } = await servicesHubPlaceholderPage.resolveProps(params);

  return (
    <PlaceholderPageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <EmptyPagePlaceholder title={title} />
    </PlaceholderPageLayout>
  );
}
