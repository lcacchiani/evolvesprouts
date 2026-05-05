'use client';

import { useContext } from 'react';

import { LandingPageBookingCtaAction } from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { LandingPageCalendarContext } from '@/lib/landing-page-calendar-context';

interface LandingPageInlineCalendarCtaProps {
  analyticsSectionId: string;
  ctaLocation?: string;
  buttonClassName?: string;
}

export function LandingPageInlineCalendarCta({
  analyticsSectionId,
  ctaLocation = 'landing_page',
  buttonClassName,
}: LandingPageInlineCalendarCtaProps) {
  const calendar = useContext(LandingPageCalendarContext);
  if (!calendar) {
    return null;
  }

  if (calendar.heroAnchorCta) {
    return (
      <SectionCtaAnchor
        href={calendar.heroAnchorCta.href}
        className={buttonClassName}
      >
        {calendar.heroAnchorCta.label}
      </SectionCtaAnchor>
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
