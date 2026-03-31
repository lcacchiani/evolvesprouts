import type { SiteContent } from '@/content';
import { buildWhatsappPrefilledHref } from '@/lib/site-config';
import { PageLayout } from '@/components/shared/page-layout';
import { Faq } from '@/components/sections/faq';
import { FreeIntroSession } from '@/components/sections/free-intro-session';
import { ConsultationsHero } from '@/components/sections/consultations/consultations-hero';
import { ConsultationsHowItWorks } from '@/components/sections/consultations/consultations-how-it-works';
import { ConsultationsFocusDetails } from '@/components/sections/consultations/consultations-focus-details';
import { ConsultationsComparison } from '@/components/sections/consultations/consultations-comparison';
import { ConsultationsCta } from '@/components/sections/consultations/consultations-cta';

interface ConsultationsPageProps {
  content: SiteContent;
}

function resolveCtaWhatsappHref(
  baseWhatsappHref: string,
  prefillMessage: string,
  phoneNumber: string,
  fallbackHref: string,
): string {
  return (
    buildWhatsappPrefilledHref(baseWhatsappHref, prefillMessage, phoneNumber)
    || fallbackHref
  );
}

export function ConsultationsPage({ content }: ConsultationsPageProps) {
  const consultations = content.consultations;
  const whatsappBaseHref = content.freeIntroSession.ctaHref;
  const whatsappPhoneNumber = content.freeIntroSession.phoneNumber;

  const primaryCtaHref = resolveCtaWhatsappHref(
    whatsappBaseHref,
    consultations.cta.primaryPrefillMessage,
    whatsappPhoneNumber,
    whatsappBaseHref,
  );

  const secondaryCtaHref = resolveCtaWhatsappHref(
    whatsappBaseHref,
    consultations.cta.secondaryPrefillMessage,
    whatsappPhoneNumber,
    whatsappBaseHref,
  );

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <ConsultationsHero content={consultations.hero} />
      <ConsultationsHowItWorks content={consultations.howItWorks} />
      <ConsultationsFocusDetails content={consultations.focusDetails} />
      <ConsultationsComparison content={consultations.comparison} />
      <ConsultationsCta
        content={consultations.cta}
        resolvedPrimaryCtaHref={primaryCtaHref}
        resolvedSecondaryCtaHref={secondaryCtaHref}
      />
      <Faq content={content.faq} />
      <FreeIntroSession content={content.freeIntroSession} />
    </PageLayout>
  );
}
