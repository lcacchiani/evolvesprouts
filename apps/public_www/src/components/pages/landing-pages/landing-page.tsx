import type {
  Locale,
  LandingPageLocaleContent,
  SiteContent,
} from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { AboutUsIdaCoach } from '@/components/sections/about-us-ida-coach';
import { Testimonials } from '@/components/sections/testimonials';
import { LandingPageCtaBridge } from '@/components/pages/landing-pages/landing-page-cta-bridge';
import { LandingPageEventJsonLd } from '@/components/pages/landing-pages/landing-page-event-jsonld';
import { LandingPageHeroBridge } from '@/components/pages/landing-pages/landing-page-hero-bridge';
import { LandingPageDescription } from '@/components/sections/landing-pages/landing-page-description';
import { LandingPageDetails } from '@/components/sections/landing-pages/landing-page-details';
import { LandingPageFaq } from '@/components/sections/landing-pages/landing-page-faq';
import { LandingPageOutline } from '@/components/sections/landing-pages/landing-page-outline';
import { LandingPageRehydrateRoot } from '@/lib/landing-page-calendar-context';
import { resolvePublicSiteConfig } from '@/lib/site-config';
import type {
  LandingPageBookingEventContent,
  LandingPageHeroEventContent,
  LandingPageStructuredDataContent,
} from '@/lib/events-data';

export interface LandingPageProps {
  locale: Locale;
  slug: string;
  pagePath: string;
  siteContent: SiteContent;
  pageContent: LandingPageLocaleContent;
  heroEventContent: LandingPageHeroEventContent | null;
  bookingEventContent: LandingPageBookingEventContent | null;
  structuredDataContent: LandingPageStructuredDataContent | null;
}

export function LandingPage({
  locale,
  slug,
  pagePath,
  siteContent,
  pageContent,
  heroEventContent,
  bookingEventContent,
  structuredDataContent,
}: LandingPageProps) {
  const publicSiteConfig = resolvePublicSiteConfig();

  return (
    <LandingPageRehydrateRoot
      key={`${slug}-${locale}`}
      locale={locale}
      slug={slug}
      siteContent={siteContent}
      pageContent={pageContent}
      initialHero={heroEventContent}
      initialBooking={bookingEventContent}
      initialStructuredData={structuredDataContent}
      thankYouWhatsappHref={publicSiteConfig.whatsappUrl}
    >
      <PageLayout
        navbarContent={siteContent.navbar}
        footerContent={siteContent.footer}
      >
        <LandingPageHeroBridge
          slug={slug}
          content={pageContent.hero}
          ctaContent={pageContent.cta}
          commonContent={siteContent.landingPages.common}
          locale={locale}
          metaTitle={pageContent.meta.title}
          bookingModalContent={siteContent.bookingModal}
          ariaLabel={siteContent.landingPages.common.a11y.heroSectionLabel}
        />
        <LandingPageOutline
          content={pageContent.outline}
          ariaLabel={siteContent.landingPages.common.a11y.outlineSectionLabel}
        />
        <LandingPageDescription
          content={pageContent.description}
          ariaLabel={siteContent.landingPages.common.a11y.descriptionSectionLabel}
        />
        <LandingPageDetails
          content={pageContent.details}
          ariaLabel={siteContent.landingPages.common.a11y.detailsSectionLabel}
        />
        <Testimonials
          content={siteContent.testimonials}
          commonAccessibility={siteContent.common.accessibility}
        />
        <LandingPageCtaBridge
          locale={locale}
          slug={slug}
          content={pageContent.cta}
          commonContent={siteContent.landingPages.common}
          ariaLabel={siteContent.landingPages.common.a11y.ctaSectionLabel}
        />
        <AboutUsIdaCoach
          content={siteContent.aboutUs.coaches.ida}
          ariaLabel={siteContent.landingPages.common.a11y.aboutUsIdaCoachSectionLabel}
        />
        <LandingPageFaq
          content={pageContent.faq}
          ariaLabel={siteContent.landingPages.common.a11y.faqSectionLabel}
        />
      </PageLayout>
      <LandingPageEventJsonLd
        locale={locale}
        pagePath={pagePath}
      />
    </LandingPageRehydrateRoot>
  );
}
