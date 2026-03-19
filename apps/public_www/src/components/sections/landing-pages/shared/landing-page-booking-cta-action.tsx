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
import { formatContentTemplate } from '@/content/content-field-utils';
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

export interface LandingPageBookingCtaActionProps {
  locale: Locale;
  slug: string;
  content: LandingPageLocaleContent['cta'];
  ctaPriceLabel?: string;
  commonContent: LandingPagesCommonContent;
  bookingPayload: EventBookingModalPayload | null;
  isFullyBooked: boolean;
  fullyBookedCtaLabel?: string;
  fullyBookedWaitlistHref?: string;
  bookingModalContent: BookingModalContent;
  analyticsSectionId: string;
  ctaLocation: string;
  buttonClassName?: string;
}

export type LandingPageSharedCtaProps = Omit<
  LandingPageBookingCtaActionProps,
  'analyticsSectionId' | 'ctaLocation' | 'buttonClassName'
>;

function resolveCtaLabel(
  content: LandingPageLocaleContent['cta'],
  commonContent: LandingPagesCommonContent,
  ctaPriceLabel: string | undefined,
): string {
  const fallbackLabel = content.buttonLabel || commonContent.defaultCtaLabel;
  const buttonLabelTemplate = content.buttonLabelTemplate?.trim() ?? '';
  const normalizedPriceLabel = ctaPriceLabel?.trim() ?? '';
  if (!buttonLabelTemplate || !normalizedPriceLabel) {
    return fallbackLabel;
  }

  const resolvedTemplateLabel = formatContentTemplate(buttonLabelTemplate, {
    price: normalizedPriceLabel,
  }).trim();
  return resolvedTemplateLabel || fallbackLabel;
}

function resolveFullyBookedCtaLabel(
  content: LandingPageLocaleContent['cta'],
  commonContent: LandingPagesCommonContent,
  overrideLabel: string | undefined,
): string {
  const normalizedOverrideLabel = overrideLabel?.trim();
  if (normalizedOverrideLabel) {
    return normalizedOverrideLabel;
  }

  const normalizedContentLabel = content.fullyBookedButtonLabel?.trim();
  if (normalizedContentLabel) {
    return normalizedContentLabel;
  }

  return content.buttonLabel || commonContent.defaultCtaLabel;
}

export function LandingPageBookingCtaAction({
  locale,
  slug,
  content,
  ctaPriceLabel,
  commonContent,
  bookingPayload,
  isFullyBooked,
  fullyBookedCtaLabel,
  fullyBookedWaitlistHref,
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
  const defaultCtaLabel = resolveCtaLabel(content, commonContent, ctaPriceLabel);
  const ctaLabel = isFullyBooked
    ? resolveFullyBookedCtaLabel(content, commonContent, fullyBookedCtaLabel)
    : defaultCtaLabel;
  const normalizedFullyBookedWaitlistHref = fullyBookedWaitlistHref?.trim() ?? '';
  const shouldUseFullyBookedWaitlistLink = isFullyBooked && Boolean(normalizedFullyBookedWaitlistHref);

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
      {shouldUseFullyBookedWaitlistLink ? (
        <ButtonPrimitive
          variant='primary'
          className={buttonClassName}
          href={normalizedFullyBookedWaitlistHref}
          onClick={() => {
            trackAnalyticsEvent('landing_page_cta_click', {
              sectionId: analyticsSectionId,
              ctaLocation,
              params: {
                landing_page_slug: slug,
                age_group: '',
                cohort_label: selectedDateLabel,
              },
            });
          }}
        >
          {ctaLabel}
        </ButtonPrimitive>
      ) : (
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
      )}

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
