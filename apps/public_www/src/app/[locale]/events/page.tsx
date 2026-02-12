import { Footer } from '@/components/sections/footer';
import { Navbar } from '@/components/sections/navbar';
import { Events } from '@/components/sections/events';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import {
  getMenuLabel,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { buildLocalizedMetadata } from '@/lib/seo';

interface EventsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: EventsPageProps) {
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

export default async function EventsPage({ params }: EventsPageProps) {
  const { content } = await resolveLocalePageContext(params);

  return (
    <>
      <Navbar content={content.navbar} />
      <main id='main-content' tabIndex={-1} className='min-h-screen'>
        <Events content={content.events} />
        <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
