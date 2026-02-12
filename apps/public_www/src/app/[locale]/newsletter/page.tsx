import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderPageMetadata,
  getFooterLinkLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface NewsletterPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NewsletterPageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(content, '/newsletter', 'Newsletter');

  return buildPlaceholderPageMetadata({
    locale,
    path: '/newsletter',
    title,
  });
}

export default async function NewsletterPage({ params }: NewsletterPageProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(content, '/newsletter', 'Newsletter');

  return <EmptyPagePlaceholder title={title} />;
}
