import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Faq } from '@/components/sections/faq';
import { FreeIntroSession } from '@/components/sections/free-intro-session';
import { ConsultationsHero } from '@/components/sections/consultations/consultations-hero';
import { ConsultationBooking } from '@/components/sections/consultations/consultations-booking';
import { ConsultationsFocusDetails } from '@/components/sections/consultations/consultations-focus-details';
import { ConsultationsComparison } from '@/components/sections/consultations/consultations-comparison';

interface ConsultationsPageProps {
  content: SiteContent;
}

export function ConsultationsPage({ content }: ConsultationsPageProps) {
  const consultations = content.consultations;

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <ConsultationsHero content={consultations.hero} />
      <ConsultationBooking content={consultations.booking} />
      <ConsultationsFocusDetails content={consultations.focusDetails} />
      <ConsultationsComparison content={consultations.comparison} />
      <Faq content={content.faq} />
      <FreeIntroSession content={content.freeIntroSession} />
    </PageLayout>
  );
}
