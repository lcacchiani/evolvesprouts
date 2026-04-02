import { ConsultationsPage } from '@/components/pages/consultations';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  getFooterLinkLabel,
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';
import { buildBreadcrumbSchema, buildFaqPageSchema } from '@/lib/structured-data';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = content.seo.consultations.title || getFooterLinkLabel(
    content,
    ROUTES.servicesConsultations,
  );
  const description = content.seo.consultations.description;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.servicesConsultations,
    title,
    description,
    socialImage: {
      url: content.seo.socialImages.consultations.url,
      alt: content.seo.socialImages.consultations.alt,
    },
  });
}

export default async function ConsultationsRoutePage({
  params,
}: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle = content.seo.consultations.title || getFooterLinkLabel(
    content,
    ROUTES.servicesConsultations,
  );

  return (
    <>
      <ConsultationsPage content={content} />
      <StructuredDataScript
        id={`consultations-breadcrumb-jsonld-${locale}`}
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
              path: ROUTES.servicesConsultations,
            },
          ],
        })}
      />
      <StructuredDataScript
        id={`consultations-faq-jsonld-${locale}`}
        data={buildFaqPageSchema(content.faq)}
      />
    </>
  );
}
