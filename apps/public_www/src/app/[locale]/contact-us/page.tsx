import { ContactUsPageSections } from '@/components/contact-us';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';

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
  });
}

export default async function ContactUsPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return <ContactUsPageSections content={content} />;
}
