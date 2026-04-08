import type { Locale, SiteContent } from '@/content';
import calendarAvailability from '@/content/calendar-availability.json';
import { resolvePublicSiteConfig } from '@/lib/site-config';
import { PageLayout } from '@/components/shared/page-layout';
import { Faq } from '@/components/sections/faq';
import { FreeIntroSession } from '@/components/sections/free-intro-session';
import { ConsultationsHero } from '@/components/sections/consultations/consultations-hero';
import { ConsultationsBooking } from '@/components/sections/consultations/consultations-booking';
import { ConsultationsFocusDetails } from '@/components/sections/consultations/consultations-focus-details';
import { ConsultationsComparison } from '@/components/sections/consultations/consultations-comparison';

interface ConsultationsPageProps {
  locale: Locale;
  content: SiteContent;
}

export function ConsultationsPage({ locale, content }: ConsultationsPageProps) {
  const consultations = content.consultations;
  const publicSiteConfig = resolvePublicSiteConfig();

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <ConsultationsHero content={consultations.hero} />
      <ConsultationsBooking
        locale={locale}
        content={consultations.booking}
        bookingModalContent={content.bookingModal}
        calendarAvailability={calendarAvailability}
        thankYouWhatsappHref={publicSiteConfig.whatsappUrl}
        thankYouWhatsappCtaLabel={content.contactUs.form.contactMethodLinks.whatsapp}
        commonAccessibility={content.common.accessibility}
      />
      <ConsultationsFocusDetails
        content={consultations.focusDetails}
        commonAccessibility={content.common.accessibility}
      />
      <ConsultationsComparison content={consultations.comparison} />
      <Faq content={content.faq} />
      <FreeIntroSession content={content.freeIntroSession} />
    </PageLayout>
  );
}
