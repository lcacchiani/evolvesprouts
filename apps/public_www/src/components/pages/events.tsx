import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Events } from '@/components/sections/events';
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
    </PageLayout>
  );
}
