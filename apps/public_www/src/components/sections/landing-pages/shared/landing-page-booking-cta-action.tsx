'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
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

interface LandingPageBookingCtaActionProps {
  locale: Locale;
  slug: string;
  content: LandingPageLocaleContent['cta'];
  commonContent: LandingPagesCommonContent;
  bookingPayload: EventBookingModalPayload | null;
  isFullyBooked: boolean;
  bookingModalContent: BookingModalContent;
  analyticsSectionId: string;
  ctaLocation: string;
  buttonClassName?: string;
}

export function LandingPageBookingCtaAction({
  locale,
  slug,
  content,
  commonContent,
  bookingPayload,
  isFullyBooked,
  bookingModalContent,
  analyticsSectionId,
  ctaLocation,
  buttonClassName,
}: LandingPageBookingCtaActionProps) {
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
      sectionId: analyticsSectionId,
      ctaLocation,
      params: {
        age_group: '',
        cohort_label: selectedDateLabel,
        cohort_date: selectedDate,
      },
    });
  }, [
    analyticsSectionId,
    bookingPayload,
    ctaLocation,
    isFullyBooked,
    isPaymentModalOpen,
    selectedDate,
    selectedDateLabel,
  ]);

  return (
    <>
      <ButtonPrimitive
        variant='primary'
        className={buttonClassName}
        disabled={!bookingPayload || isFullyBooked}
        onClick={() => {
          if (!bookingPayload || isFullyBooked) {
            return;
          }

          trackAnalyticsEvent('landing_page_cta_click', {
            sectionId: analyticsSectionId,
            ctaLocation,
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
