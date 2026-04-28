'use client';

import { useContext } from 'react';

import { LandingPageHero } from '@/components/sections/landing-pages/landing-page-hero';
import type {
  BookingModalContent,
  LandingPagesCommonContent,
  LandingPageLocaleContent,
  Locale,
} from '@/content';
import { LandingPageCalendarContext } from '@/lib/landing-page-calendar-context';

interface LandingPageHeroBridgeProps {
  slug: string;
  content: LandingPageLocaleContent['hero'];
  ctaContent: LandingPageLocaleContent['cta'];
  commonContent: LandingPagesCommonContent;
  locale: Locale;
  metaTitle: string;
  bookingModalContent: BookingModalContent;
  ariaLabel?: string;
}

export function LandingPageHeroBridge({
  slug,
  content,
  ctaContent,
  commonContent,
  locale,
  metaTitle,
  bookingModalContent,
  ariaLabel,
}: LandingPageHeroBridgeProps) {
  const calendar = useContext(LandingPageCalendarContext);
  if (!calendar) {
    return null;
  }

  const { heroEventContent, bookingEventContent, sharedCtaProps } = calendar;
  const isFullyBooked = bookingEventContent?.status === 'fully_booked';

  return (
    <LandingPageHero
      slug={slug}
      content={content}
      ctaContent={ctaContent}
      ctaPriceLabel={bookingEventContent?.ctaPriceLabel}
      commonContent={commonContent}
      locale={locale}
      title={heroEventContent?.title ?? metaTitle}
      eventContent={heroEventContent}
      bookingPayload={bookingEventContent?.bookingPayload ?? null}
      isFullyBooked={isFullyBooked}
      fullyBookedCtaLabel={ctaContent.fullyBookedButtonLabel}
      fullyBookedWaitlistHref={sharedCtaProps.fullyBookedWaitlistHref}
      bookingModalContent={bookingModalContent}
      thankYouWhatsappHref={sharedCtaProps.thankYouWhatsappHref}
      thankYouWhatsappCtaLabel={sharedCtaProps.thankYouWhatsappCtaLabel}
      ariaLabel={ariaLabel}
    />
  );
}
