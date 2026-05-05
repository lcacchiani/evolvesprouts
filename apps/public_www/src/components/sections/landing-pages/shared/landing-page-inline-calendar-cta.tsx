'use client';

import { useContext } from 'react';

import { LandingPageBookingCtaAction } from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { LandingPageCalendarContext } from '@/lib/landing-page-calendar-context';

interface LandingPageInlineCalendarCtaProps {
  analyticsSectionId: string;
  ctaLocation?: string;
  buttonClassName?: string;
  /** When calendar context is absent (e.g. book-a-free-call), render this anchor instead of hiding the CTA. */
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
  const calendar = useContext(LandingPageCalendarContext);
  if (!calendar) {
    const trimmedHref = fallbackAnchorHref?.trim() ?? '';
    const trimmedLabel = fallbackAnchorLabel?.trim() ?? '';
    if (!trimmedHref || !trimmedLabel) {
      return null;
    }

    return (
      <ButtonPrimitive
        variant='primary'
        className={buttonClassName}
        href={trimmedHref}
      >
        {trimmedLabel}
      </ButtonPrimitive>
    );
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
