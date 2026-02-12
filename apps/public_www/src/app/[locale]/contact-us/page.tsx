import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderPageMetadata,
  getMenuLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface ContactUsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ContactUsPageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/contact-us', 'Contact Us');

  return buildPlaceholderPageMetadata({
    locale,
    path: '/contact-us',
    title,
  });
}

export default async function ContactUsPage({ params }: ContactUsPageProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/contact-us', 'Contact Us');

  return <EmptyPagePlaceholder title={title} />;
}
