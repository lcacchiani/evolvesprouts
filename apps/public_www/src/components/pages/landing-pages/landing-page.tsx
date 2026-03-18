import type {
  Locale,
  LandingPageLocaleContent,
  SiteContent,
} from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { LandingPageCta } from '@/components/sections/landing-pages/landing-page-cta';
import { LandingPageDetails } from '@/components/sections/landing-pages/landing-page-details';
import { LandingPageFaq } from '@/components/sections/landing-pages/landing-page-faq';
import { LandingPageHero } from '@/components/sections/landing-pages/landing-page-hero';
import { getLandingPageHeroEventContent } from '@/lib/events-data';

interface LandingPageProps {
  locale: Locale;
  slug: string;
  siteContent: SiteContent;
  pageContent: LandingPageLocaleContent;
}

export function LandingPage({
  locale,
  slug,
  siteContent,
  pageContent,
}: LandingPageProps) {
  const heroEventContent = getLandingPageHeroEventContent(slug);

  return (
    <PageLayout
      navbarContent={siteContent.navbar}
      footerContent={siteContent.footer}
    >
      <LandingPageHero
        content={pageContent.hero}
        locale={locale}
        title={heroEventContent?.title ?? pageContent.meta.title}
        eventContent={heroEventContent}
        ariaLabel={siteContent.landingPages.common.a11y.heroSectionLabel}
      />
      <LandingPageDetails
        content={pageContent.details}
        ariaLabel={siteContent.landingPages.common.a11y.detailsSectionLabel}
      />
      <DeferredTestimonials
        content={siteContent.testimonials}
        commonAccessibility={siteContent.common.accessibility}
      />
      <LandingPageCta
        locale={locale}
        slug={slug}
        content={pageContent.cta}
        commonContent={siteContent.landingPages.common}
        bookingContent={pageContent.booking}
        bookingModalContent={siteContent.bookingModal}
        ariaLabel={siteContent.landingPages.common.a11y.ctaSectionLabel}
      />
      <LandingPageFaq
        content={pageContent.faq}
        ariaLabel={siteContent.landingPages.common.a11y.faqSectionLabel}
      />
    </PageLayout>
  );
}
