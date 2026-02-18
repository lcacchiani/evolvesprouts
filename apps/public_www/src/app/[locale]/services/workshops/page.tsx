import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import { PlaceholderPageLayout } from '@/components/placeholder-page-layout';
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
    <PlaceholderPageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <EmptyPagePlaceholder title={title} />
    </PlaceholderPageLayout>
  );
}
