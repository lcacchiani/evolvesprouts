import { EmptyPagePlaceholder } from '@/components/empty-page-placeholder';
import {
  buildPlaceholderPageMetadata,
  getMenuLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface EventsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: EventsPageProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/events', 'Events');

  return buildPlaceholderPageMetadata({
    locale,
    path: '/events',
    title,
  });
}

export default async function EventsPage({ params }: EventsPageProps) {
  const { content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/events', 'Events');

  return <EmptyPagePlaceholder title={title} />;
}
