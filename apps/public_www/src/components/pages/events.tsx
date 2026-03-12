import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Events } from '@/components/sections/events';
import { EventNotification } from '@/components/sections/event-notification';
import { PastEvents } from '@/components/sections/past-events';
import { FreeIntroSession } from '@/components/sections/free-intro-session';

interface EventsPageSectionsProps {
  content: SiteContent;
}

export function EventsPageSections({ content }: EventsPageSectionsProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <Events content={content.events} locale={content.meta.locale} />
      <FreeIntroSession content={content.freeIntroSession} />
      <PastEvents content={content.events} locale={content.meta.locale} />
      <EventNotification content={content.eventNotification} />
    </PageLayout>
  );
}
