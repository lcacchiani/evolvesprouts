import { ContactUsPageSections } from '@/components/contact-us-page-sections';
import {
  getMenuLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

interface ContactUsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ContactUsPageProps) {
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

export default async function ContactUsPage({ params }: ContactUsPageProps) {
  const { content } = await resolveLocalePageContext(params);

  return <ContactUsPageSections content={content} />;
}
