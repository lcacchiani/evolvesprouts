import type { ReactNode } from 'react';

import {
  MINIMAL_LANDING_PAGE_CTA_FOR_CALENDAR,
  type Locale,
  type LandingPageLocaleContent,
  type SiteContent,
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

export type LandingPageLayoutVariant = 'default' | 'book-free-call';

export interface LandingPageProps {
  locale: Locale;
  slug: string;
  pagePath: string;
  siteContent: SiteContent;
  pageContent: LandingPageLocaleContent;
  heroEventContent: LandingPageHeroEventContent | null;
  bookingEventContent: LandingPageBookingEventContent | null;
  structuredDataContent: LandingPageStructuredDataContent | null;
  /** Optional slot between testimonials and the CTA bridge (e.g. intro-call booking). */
  introCallSectionBeforeCta?: ReactNode;
  /** Reorders sections for the intro-call landing page (no outline / mid-page CTA strip). */
  layoutVariant?: LandingPageLayoutVariant;
  /**
   * Mid-section calendar CTAs resolve from calendar context; when absent (book-a-free-call),
   * inline CTAs use this localized path + hash instead of rendering nothing.
   */
  inlineCalendarFallbackAnchorHref?: string;
  inlineCalendarFallbackAnchorLabel?: string;
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
  introCallSectionBeforeCta,
  layoutVariant = 'default',
  inlineCalendarFallbackAnchorHref,
  inlineCalendarFallbackAnchorLabel,
}: LandingPageProps) {
  const publicSiteConfig = resolvePublicSiteConfig();
  const heroCtaContent = pageContent.cta ?? MINIMAL_LANDING_PAGE_CTA_FOR_CALENDAR;

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
          ctaContent={heroCtaContent}
          commonContent={siteContent.landingPages.common}
          locale={locale}
          metaTitle={pageContent.meta.title}
          bookingModalContent={siteContent.bookingModal}
          ariaLabel={siteContent.landingPages.common.a11y.heroSectionLabel}
        />
        {layoutVariant === 'book-free-call' ? (
          <>
            <LandingPageDetails
              content={pageContent.details}
              ariaLabel={siteContent.landingPages.common.a11y.detailsSectionLabel}
              inlineCalendarFallbackAnchorHref={inlineCalendarFallbackAnchorHref}
              inlineCalendarFallbackAnchorLabel={inlineCalendarFallbackAnchorLabel}
            />
            {introCallSectionBeforeCta}
            <LandingPageDescription
              content={pageContent.description}
              ariaLabel={
                siteContent.landingPages.common.a11y.descriptionSectionLabel
              }
              inlineCalendarFallbackAnchorHref={inlineCalendarFallbackAnchorHref}
              inlineCalendarFallbackAnchorLabel={inlineCalendarFallbackAnchorLabel}
            />
            <Testimonials
              content={siteContent.testimonials}
              commonAccessibility={siteContent.common.accessibility}
            />
            <AboutUsIdaCoach
              content={siteContent.aboutUs.coaches.ida}
              ariaLabel={
                siteContent.landingPages.common.a11y.aboutUsIdaCoachSectionLabel
              }
            />
            <LandingPageFaq
              content={pageContent.faq}
              ariaLabel={siteContent.landingPages.common.a11y.faqSectionLabel}
            />
          </>
        ) : (
          <>
            {pageContent.outline ? (
              <LandingPageOutline
                content={pageContent.outline}
                ariaLabel={siteContent.landingPages.common.a11y.outlineSectionLabel}
              />
            ) : null}
            <LandingPageDescription
              content={pageContent.description}
              ariaLabel={
                siteContent.landingPages.common.a11y.descriptionSectionLabel
              }
            />
            <LandingPageDetails
              content={pageContent.details}
              ariaLabel={siteContent.landingPages.common.a11y.detailsSectionLabel}
            />
            <Testimonials
              content={siteContent.testimonials}
              commonAccessibility={siteContent.common.accessibility}
            />
            {introCallSectionBeforeCta}
            {pageContent.cta ? (
              <LandingPageCtaBridge
                locale={locale}
                slug={slug}
                content={pageContent.cta}
                commonContent={siteContent.landingPages.common}
                ariaLabel={siteContent.landingPages.common.a11y.ctaSectionLabel}
              />
            ) : null}
            <AboutUsIdaCoach
              content={siteContent.aboutUs.coaches.ida}
              ariaLabel={
                siteContent.landingPages.common.a11y.aboutUsIdaCoachSectionLabel
              }
            />
            <LandingPageFaq
              content={pageContent.faq}
              ariaLabel={siteContent.landingPages.common.a11y.faqSectionLabel}
            />
          </>
        )}
      </PageLayout>
      <LandingPageEventJsonLd
        locale={locale}
        pagePath={pagePath}
      />
    </LandingPageRehydrateRoot>
  );
}
