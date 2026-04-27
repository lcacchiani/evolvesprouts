import {
  DEFAULT_LOCALE,
  isValidLocale,
  type SiteContent,
} from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Events } from '@/components/sections/events';
import { EventNotification } from '@/components/sections/event-notification';
import { PastEvents } from '@/components/sections/past-events';
import { FreeIntroSession } from '@/components/sections/free-intro-session';
import { EventsDataProvider } from '@/components/sections/shared/events-shared';
import { resolvePublicSiteConfig } from '@/lib/site-config';

interface EventsPageProps {
  content: SiteContent;
}

export function EventsPage({ content }: EventsPageProps) {
  const resolvedLocale = isValidLocale(content.meta.locale)
    ? content.meta.locale
    : DEFAULT_LOCALE;
  const publicSiteConfig = resolvePublicSiteConfig();

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <EventsDataProvider content={content.events} locale={resolvedLocale}>
        <Events
          content={content.events}
          bookingModalContent={content.bookingModal}
          myBestAuntieModalContent={content.myBestAuntie.modal}
          locale={resolvedLocale}
          thankYouWhatsappHref={publicSiteConfig.whatsappUrl}
          thankYouWhatsappCtaLabel={content.contactUs.form.contactMethodLinks.whatsapp}
        />
        <FreeIntroSession
          content={content.freeIntroSession}
          titleOverride={content.freeIntroSession.eventPageTitle}
          sectionClassName="es-free-intro-session-section--standard-spacing"
        />
        <PastEvents content={content.events} locale={resolvedLocale} />
      </EventsDataProvider>
      <EventNotification
        content={content.events.notification}
        commonCaptchaContent={content.common.captcha}
        commonFormActionsContent={content.common.formActions}
        locale={resolvedLocale}
      />
    </PageLayout>
  );
}
