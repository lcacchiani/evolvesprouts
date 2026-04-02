import { FreeGuidesAndResourcesPage } from '@/components/pages/free-guides-and-resources';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';
import {
  buildBreadcrumbSchema,
  buildFaqJsonLd,
} from '@/lib/structured-data';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title =
    content.seo.freeGuidesAndResources.title ||
    getMenuLabel(content, ROUTES.freeGuidesAndResources);
  const description = content.seo.freeGuidesAndResources.description;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.freeGuidesAndResources,
    title,
    description,
    socialImage: {
      url: content.seo.socialImages.freeGuidesAndResources.url,
      alt: content.seo.socialImages.freeGuidesAndResources.alt,
    },
  });
}

export default async function FreeGuidesAndResourcesRoutePage({
  params,
}: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle =
    getMenuLabel(content, ROUTES.freeGuidesAndResources) ||
    content.seo.freeGuidesAndResources.title;

  return (
    <>
      <FreeGuidesAndResourcesPage content={content} />
      <StructuredDataScript
        id={`free-guides-and-resources-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(content, ROUTES.home),
              path: ROUTES.home,
            },
            {
              name: content.footer.services.title,
              path: ROUTES.servicesIndex,
            },
            {
              name: pageTitle,
              path: ROUTES.freeGuidesAndResources,
            },
          ],
        })}
      />
      <StructuredDataScript
        id={`free-guides-and-resources-faq-jsonld-${locale}`}
        data={buildFaqJsonLd(content.freeGuidesAndResources.faq.cards)}
      />
    </>
  );
}
