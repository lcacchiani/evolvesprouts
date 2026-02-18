import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Events } from '@/components/sections/events';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';

interface EventsPageSectionsProps {
  content: SiteContent;
}

export function EventsPageSections({ content }: EventsPageSectionsProps) {
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
