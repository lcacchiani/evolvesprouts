import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderPageMetadata,
  getFooterLinkLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface WorkshopsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: WorkshopsPageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(content, '/services/workshops', 'Workshops');

  return buildPlaceholderPageMetadata({
    locale,
    path: '/services/workshops',
    title,
  });
}

export default async function WorkshopsPage({ params }: WorkshopsPageProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getFooterLinkLabel(content, '/services/workshops', 'Workshops');

  return <EmptyPagePlaceholder title={title} />;
}
