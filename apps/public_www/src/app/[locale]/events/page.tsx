import { EventsPageSections } from '@/components/pages/events';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';
import { buildBreadcrumbSchema } from '@/lib/structured-data';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, ROUTES.events, 'Events');
  const description = content.events.description;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.events,
    title,
    description,
    socialImage: {
      url: content.seo.defaultSocialImage,
      alt: content.seo.defaultSocialImageAlt,
    },
  });
}

export default async function EventsPage({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle = getMenuLabel(content, ROUTES.events, 'Events');

  return (
    <>
      <EventsPageSections content={content} />
      <StructuredDataScript
        id={`events-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(content, ROUTES.home, 'Home'),
              path: ROUTES.home,
            },
            {
              name: pageTitle,
              path: ROUTES.events,
            },
          ],
        })}
      />
    </>
  );
}
