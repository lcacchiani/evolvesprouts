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

function resolveWhatsappHref(
  baseHref: string,
  prefillMessage: string,
  phoneNumber: string,
  fallbackHref: string,
): string {
  return (
    buildWhatsappPrefilledHref(baseHref, prefillMessage, phoneNumber)
    || fallbackHref
  );
}

export function ConsultationsPage({ content }: ConsultationsPageProps) {
  const consultations = content.consultations;

  const heroCtaHref = resolveWhatsappHref(
    consultations.hero.ctaHref,
    consultations.hero.prefillMessage,
    consultations.hero.phoneNumber,
    consultations.hero.ctaHref,
  );

  const primaryCtaHref = resolveWhatsappHref(
    consultations.cta.primaryCtaHref,
    consultations.cta.prefillMessage,
    consultations.cta.phoneNumber,
    consultations.cta.primaryCtaHref,
  );

  const secondaryCtaHref = resolveWhatsappHref(
    consultations.cta.secondaryCtaHref,
    consultations.cta.secondaryPrefillMessage,
    consultations.cta.phoneNumber,
    consultations.cta.secondaryCtaHref,
  );

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <ConsultationsHero
        content={consultations.hero}
        resolvedCtaHref={heroCtaHref}
      />
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
