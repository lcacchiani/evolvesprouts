'use client';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { LandingPageBookingCtaAction } from '@/components/sections/landing-pages/shared/landing-page-booking-cta-action';
import type {
  BookingModalContent,
  LandingPagesCommonContent,
  LandingPageLocaleContent,
  Locale,
} from '@/content';
import type { EventBookingModalPayload } from '@/lib/events-data';

interface LandingPageCtaProps {
  locale: Locale;
  slug: string;
  content: LandingPageLocaleContent['cta'];
  commonContent: LandingPagesCommonContent;
  bookingPayload: EventBookingModalPayload | null;
  isFullyBooked: boolean;
  bookingModalContent: BookingModalContent;
  ariaLabel?: string;
}

export function LandingPageCta({
  locale,
  slug,
  content,
  commonContent,
  bookingPayload,
  isFullyBooked,
  bookingModalContent,
  ariaLabel,
}: LandingPageCtaProps) {
  return (
    <SectionShell
      id='landing-page-cta'
      ariaLabel={ariaLabel ?? content.title}
      dataFigmaNode='landing-page-cta'
      className='es-landing-page-cta-section'
    >
      <SectionContainer>
        <SectionHeader
          title={content.title}
          description={content.description}
          align='left'
        />
        <LandingPageBookingCtaAction
          locale={locale}
          slug={slug}
          content={content}
          commonContent={commonContent}
          bookingPayload={bookingPayload}
          isFullyBooked={isFullyBooked}
          bookingModalContent={bookingModalContent}
          analyticsSectionId='landing-page-cta'
          ctaLocation='landing_page'
          buttonClassName='mt-8'
        />
      </SectionContainer>
    </SectionShell>
  );
}
