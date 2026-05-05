'use client';

import { useContext } from 'react';

import { LandingPageBookingCtaAction } from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { LandingPageCalendarContext } from '@/lib/landing-page-calendar-context';

interface LandingPageInlineCalendarCtaProps {
  analyticsSectionId: string;
  ctaLocation?: string;
  buttonClassName?: string;
  /**
   * Same pattern as `LandingPageHero` when `hero.ctaAnchorHref` / `ctaAnchorLabel` are set:
   * in-page anchor (e.g. book-a-free-call → `#intro-call-booking`). Takes precedence over
   * calendar modal CTAs so disabled placeholder buttons are not shown when the hero scrolls.
   */
  fallbackAnchorHref?: string;
  fallbackAnchorLabel?: string;
}

export function LandingPageInlineCalendarCta({
  analyticsSectionId,
  ctaLocation = 'landing_page',
  buttonClassName,
  fallbackAnchorHref,
  fallbackAnchorLabel,
}: LandingPageInlineCalendarCtaProps) {
  const trimmedHref = fallbackAnchorHref?.trim() ?? '';
  const trimmedLabel = fallbackAnchorLabel?.trim() ?? '';
  if (trimmedHref && trimmedLabel) {
    return (
      <SectionCtaAnchor
        href={trimmedHref}
        className={buttonClassName}
      >
        {trimmedLabel}
      </SectionCtaAnchor>
    );
  }

  const calendar = useContext(LandingPageCalendarContext);
  if (!calendar) {
    return null;
  }

  return (
    <LandingPageBookingCtaAction
      {...calendar.sharedCtaProps}
      analyticsSectionId={analyticsSectionId}
      ctaLocation={ctaLocation}
      buttonClassName={buttonClassName}
    />
  );
}
