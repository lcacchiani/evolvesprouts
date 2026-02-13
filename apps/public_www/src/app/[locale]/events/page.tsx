import { PageLayout } from '@/components/page-layout';
import { Events } from '@/components/sections/events';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, '/events', 'Events');
  const description = content.events.description;

  return buildLocalizedMetadata({
    locale,
    path: '/events',
    title,
    description,
  });
}

export default async function EventsPage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <Events content={content.events} />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
