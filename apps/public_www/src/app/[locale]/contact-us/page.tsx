import { ContactUsPageSections } from '@/components/contact-us';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/contact-us', 'Contact Us');
  const description = content.contactUs.contactUsForm.description;

  return buildLocalizedMetadata({
    locale,
    path: '/contact-us',
    title,
    description,
  });
}

export default async function ContactUsPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return <ContactUsPageSections content={content} />;
}
