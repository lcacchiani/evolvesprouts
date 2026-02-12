import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderPageMetadata,
  getFooterLinkLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface PrivacyPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PrivacyPageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(content, '/privacy', 'Privacy Policy');

  return buildPlaceholderPageMetadata({
    locale,
    path: '/privacy',
    title,
  });
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(content, '/privacy', 'Privacy Policy');

  return <EmptyPagePlaceholder title={title} />;
}
