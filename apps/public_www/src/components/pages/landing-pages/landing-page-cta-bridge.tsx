'use client';

import { useContext } from 'react';

import { LandingPageCta } from '@/components/sections/landing-pages/landing-page-cta';
import type {
  LandingPagesCommonContent,
  LandingPageLocaleContent,
  Locale,
} from '@/content';
import { resolveLandingPageCtaEyebrow } from '@/lib/landing-page-cta-resolve';
import { LandingPageCalendarContext } from '@/lib/landing-page-calendar-context';

interface LandingPageCtaBridgeProps {
  locale: Locale;
  slug: string;
  content: LandingPageLocaleContent['cta'];
  commonContent: LandingPagesCommonContent;
  ariaLabel?: string;
}

export function LandingPageCtaBridge({
  locale,
  slug,
  content,
  commonContent,
  ariaLabel,
}: LandingPageCtaBridgeProps) {
  const calendar = useContext(LandingPageCalendarContext);
  if (!calendar) {
    return null;
  }

  const { bookingEventContent, sharedCtaProps } = calendar;
  const isFullyBooked = bookingEventContent?.status === 'fully_booked';
  const resolvedCtaEyebrow = resolveLandingPageCtaEyebrow(
    content.eyebrow,
    bookingEventContent?.spacesLeft,
    bookingEventContent?.eyebrowDateLabel,
  );

  return (
    <LandingPageCta
      locale={locale}
      slug={slug}
      content={content}
      eyebrow={resolvedCtaEyebrow}
      ctaPriceLabel={bookingEventContent?.ctaPriceLabel}
      commonContent={commonContent}
      bookingPayload={bookingEventContent?.bookingPayload ?? null}
      isFullyBooked={isFullyBooked}
      fullyBookedCtaLabel={content.fullyBookedButtonLabel}
      fullyBookedWaitlistHref={sharedCtaProps.fullyBookedWaitlistHref}
      bookingModalContent={sharedCtaProps.bookingModalContent}
      thankYouWhatsappHref={sharedCtaProps.thankYouWhatsappHref}
      thankYouWhatsappCtaLabel={sharedCtaProps.thankYouWhatsappCtaLabel}
      ariaLabel={ariaLabel}
    />
  );
}
