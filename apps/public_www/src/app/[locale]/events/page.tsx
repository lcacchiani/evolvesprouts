import { EventsPageSections } from '@/components/pages/events';
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
  const title = getMenuLabel(content, ROUTES.events, 'Events');
  const description = content.events.description;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.events,
    title,
    description,
  });
}

export default async function EventsPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return <EventsPageSections content={content} />;
}
