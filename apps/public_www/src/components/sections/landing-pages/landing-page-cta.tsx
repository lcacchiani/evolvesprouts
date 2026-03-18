'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type {
  BookingModalContent,
  LandingPagesCommonContent,
  LandingPageLocaleContent,
  Locale,
} from '@/content';
import { trackAnalyticsEvent } from '@/lib/analytics';
import type { EventBookingModalPayload } from '@/lib/events-data';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

const EventBookingModal = dynamic(
  () =>
    import('@/components/sections/events/event-booking-modal').then(
      (module) => module.EventBookingModal,
    ),
  { ssr: false },
);

const EventThankYouModal = dynamic(
  () =>
    import('@/components/sections/events/event-thank-you-modal').then(
      (module) => module.EventThankYouModal,
    ),
  { ssr: false },
);

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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isThankYouModalOpen, setIsThankYouModalOpen] = useState(false);
  const [reservationSummary, setReservationSummary] =
    useState<ReservationSummary | null>(null);

  const selectedDateLabel = bookingPayload?.selectedDateLabel ?? '';
  const selectedDate = bookingPayload?.selectedDateStartTime?.split('T')[0] ?? '';
  const ctaLabel = content.buttonLabel || commonContent.defaultCtaLabel;

  useEffect(() => {
    if (!isPaymentModalOpen || !bookingPayload || isFullyBooked) {
      return;
    }

    trackAnalyticsEvent('booking_modal_open', {
      sectionId: 'landing-page-cta',
      ctaLocation: 'landing_page',
      params: {
        age_group: '',
        cohort_label: selectedDateLabel,
        cohort_date: selectedDate,
      },
    });
  }, [bookingPayload, isFullyBooked, isPaymentModalOpen, selectedDate, selectedDateLabel]);

  return (
    <>
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
          <ButtonPrimitive
            variant='primary'
            className='mt-8'
            disabled={!bookingPayload || isFullyBooked}
            onClick={() => {
              if (!bookingPayload || isFullyBooked) {
                return;
              }

              trackAnalyticsEvent('landing_page_cta_click', {
                sectionId: 'landing-page-cta',
                ctaLocation: 'landing_page',
                params: {
                  landing_page_slug: slug,
                  age_group: '',
                  cohort_label: selectedDateLabel,
                },
              });
              trackMetaPixelEvent('InitiateCheckout', { content_name: slug });
              setIsPaymentModalOpen(true);
            }}
          >
            {ctaLabel}
          </ButtonPrimitive>
        </SectionContainer>
      </SectionShell>

      {isPaymentModalOpen && bookingPayload && !isFullyBooked && (
        <EventBookingModal
          locale={locale}
          paymentModalContent={bookingModalContent.paymentModal}
          bookingPayload={bookingPayload}
          onClose={() => {
            setIsPaymentModalOpen(false);
          }}
          onSubmitReservation={(summary) => {
            setReservationSummary(summary);
            setIsPaymentModalOpen(false);
            setIsThankYouModalOpen(true);
          }}
        />
      )}

      {isThankYouModalOpen && (
        <EventThankYouModal
          locale={locale}
          content={{
            ...bookingModalContent.thankYouModal,
            backHomeLabel: commonContent.backToHomeLabel,
          }}
          summary={reservationSummary}
          homeHref={`/${locale}`}
          onClose={() => {
            setIsThankYouModalOpen(false);
          }}
        />
      )}
    </>
  );
}
