import type {
  Locale,
  LandingPageLocaleContent,
  SiteContent,
} from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import { PageLayout } from '@/components/shared/page-layout';
import { AboutUsIdaCoach } from '@/components/sections/about-us-ida-coach';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { LandingPageCta } from '@/components/sections/landing-pages/landing-page-cta';
import { LandingPageDescription } from '@/components/sections/landing-pages/landing-page-description';
import { LandingPageDetails } from '@/components/sections/landing-pages/landing-page-details';
import { LandingPageFaq } from '@/components/sections/landing-pages/landing-page-faq';
import { LandingPageHero } from '@/components/sections/landing-pages/landing-page-hero';
import { LandingPageOutline } from '@/components/sections/landing-pages/landing-page-outline';
import type { LandingPageSharedCtaProps } from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import {
  getLandingPageBookingEventContent,
  getLandingPageHeroEventContent,
} from '@/lib/events-data';
import { buildWhatsappPrefilledHref } from '@/lib/site-config';

interface LandingPageProps {
  locale: Locale;
  slug: string;
  siteContent: SiteContent;
  pageContent: LandingPageLocaleContent;
}

function resolveLandingPageCtaEyebrow(
  eyebrowTemplate: string | undefined,
  spotsLeft: number | undefined,
  dateLabel: string | undefined,
): string | undefined {
  const normalizedTemplate = eyebrowTemplate?.trim();
  if (!normalizedTemplate) {
    return undefined;
  }

  if (typeof spotsLeft === 'number' && Number.isFinite(spotsLeft) && spotsLeft <= 0) {
    return '';
  }

  const hasNumericSpotsLeft = typeof spotsLeft === 'number' && Number.isFinite(spotsLeft);
  if (!hasNumericSpotsLeft || !dateLabel?.trim()) {
    return normalizedTemplate;
  }

  const normalizedSpotsLeft = Math.max(0, Math.trunc(spotsLeft));

  const resolvedEyebrow = formatContentTemplate(normalizedTemplate, {
    spotsLeft: normalizedSpotsLeft,
    date: dateLabel.trim(),
  }).trim();

  return resolvedEyebrow || undefined;
}

function resolveFullyBookedWaitlistHref(
  isFullyBooked: boolean,
  baseWhatsappHref: string | undefined,
  phoneNumber: string | undefined,
  messageTemplate: string | undefined,
  eventTitle: string,
): string | undefined {
  if (!isFullyBooked) {
    return undefined;
  }

  const normalizedMessageTemplate = messageTemplate?.trim() ?? '';
  if (!normalizedMessageTemplate) {
    return undefined;
  }

  const resolvedMessage = formatContentTemplate(normalizedMessageTemplate, {
    eventTitle,
  }).trim();
  if (!resolvedMessage) {
    return undefined;
  }

  const whatsappHref = buildWhatsappPrefilledHref(baseWhatsappHref, resolvedMessage, phoneNumber);
  return whatsappHref || undefined;
}

export function LandingPage({
  locale,
  slug,
  siteContent,
  pageContent,
}: LandingPageProps) {
  const heroEventContent = getLandingPageHeroEventContent(slug);
  const bookingEventContent = getLandingPageBookingEventContent(slug, locale);
  const isFullyBooked = bookingEventContent?.status === 'fully_booked';
  const resolvedCtaEyebrow = resolveLandingPageCtaEyebrow(
    pageContent.cta.eyebrow,
    bookingEventContent?.spacesLeft,
    bookingEventContent?.eyebrowDateLabel,
  );
  const waitlistEventTitle = heroEventContent?.title ?? pageContent.meta.title;
  const fullyBookedWaitlistHref = resolveFullyBookedWaitlistHref(
    isFullyBooked,
    siteContent.navbar.bookNow.href,
    siteContent.navbar.bookNow.phoneNumber,
    pageContent.cta.fullyBookedWaitlistMessageTemplate,
    waitlistEventTitle,
  );
  const sharedCtaProps: LandingPageSharedCtaProps = {
    locale,
    slug,
    content: pageContent.cta,
    ctaPriceLabel: bookingEventContent?.ctaPriceLabel,
    commonContent: siteContent.landingPages.common,
    bookingPayload: bookingEventContent?.bookingPayload ?? null,
    isFullyBooked,
    fullyBookedCtaLabel: pageContent.cta.fullyBookedButtonLabel,
    fullyBookedWaitlistHref,
    bookingModalContent: siteContent.bookingModal,
  };

  return (
    <PageLayout
      navbarContent={siteContent.navbar}
      footerContent={siteContent.footer}
    >
      <LandingPageHero
        slug={slug}
        content={pageContent.hero}
        ctaContent={pageContent.cta}
        ctaPriceLabel={bookingEventContent?.ctaPriceLabel}
        commonContent={siteContent.landingPages.common}
        locale={locale}
        title={heroEventContent?.title ?? pageContent.meta.title}
        eventContent={heroEventContent}
        bookingPayload={bookingEventContent?.bookingPayload ?? null}
        isFullyBooked={isFullyBooked}
        fullyBookedCtaLabel={pageContent.cta.fullyBookedButtonLabel}
        fullyBookedWaitlistHref={fullyBookedWaitlistHref}
        bookingModalContent={siteContent.bookingModal}
        ariaLabel={siteContent.landingPages.common.a11y.heroSectionLabel}
      />
      <LandingPageOutline
        content={pageContent.outline}
        sharedCtaProps={sharedCtaProps}
        ariaLabel={siteContent.landingPages.common.a11y.outlineSectionLabel}
      />
      <LandingPageDescription
        content={pageContent.description}
        sharedCtaProps={sharedCtaProps}
        ariaLabel={siteContent.landingPages.common.a11y.descriptionSectionLabel}
      />
      <LandingPageDetails
        content={pageContent.details}
        sharedCtaProps={sharedCtaProps}
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
        eyebrow={resolvedCtaEyebrow}
        ctaPriceLabel={bookingEventContent?.ctaPriceLabel}
        commonContent={siteContent.landingPages.common}
        bookingPayload={bookingEventContent?.bookingPayload ?? null}
        isFullyBooked={isFullyBooked}
        fullyBookedCtaLabel={pageContent.cta.fullyBookedButtonLabel}
        fullyBookedWaitlistHref={fullyBookedWaitlistHref}
        bookingModalContent={siteContent.bookingModal}
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
  );
}
