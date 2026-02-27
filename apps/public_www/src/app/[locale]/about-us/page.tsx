import { AboutUs } from '@/components/pages/about-us';
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
  buildFaqPageSchema,
} from '@/lib/structured-data';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, ROUTES.about, 'About Us');
  const description = content.ida.subtitle;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.about,
    title,
    description,
    socialImage: {
      url: content.seo.socialImages.about.url,
      alt: content.seo.socialImages.about.alt,
    },
  });
}

export default async function AboutUsPage({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle = getMenuLabel(content, ROUTES.about, 'About Us');

  return (
    <>
      <AboutUs content={content} />
      <StructuredDataScript
        id={`about-us-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(content, ROUTES.home, 'Home'),
              path: ROUTES.home,
            },
            {
              name: pageTitle,
              path: ROUTES.about,
            },
          ],
        })}
      />
      <StructuredDataScript
        id={`about-us-faq-jsonld-${locale}`}
        data={buildFaqPageSchema(content.faq)}
      />
    </>
  );
}
