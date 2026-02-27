import { ContactUsPageSections } from '@/components/pages/contact-us';
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
  const title = getMenuLabel(content, ROUTES.contact, 'Contact Us');
  const description = content.contactUs.contactUsForm.description;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.contact,
    title,
    description,
    socialImage: {
      url: content.seo.socialImages.contact.url,
      alt: content.seo.socialImages.contact.alt,
    },
  });
}

export default async function ContactUsPage({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle = getMenuLabel(content, ROUTES.contact, 'Contact Us');

  return (
    <>
      <ContactUsPageSections content={content} />
      <StructuredDataScript
        id={`contact-us-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(content, ROUTES.home, 'Home'),
              path: ROUTES.home,
            },
            {
              name: pageTitle,
              path: ROUTES.contact,
            },
          ],
        })}
      />
    </>
  );
}
