'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type {
  BookingModalContent,
  LandingPageBookingContent,
  LandingPagesCommonContent,
  LandingPageLocaleContent,
  Locale,
} from '@/content';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

const MyBestAuntieBookingModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieBookingModal,
    ),
  { ssr: false },
);

const MyBestAuntieThankYouModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieThankYouModal,
    ),
  { ssr: false },
);

interface LandingPageCtaProps {
  locale: Locale;
  slug: string;
  content: LandingPageLocaleContent['cta'];
  commonContent: LandingPagesCommonContent;
  bookingContent: LandingPageBookingContent;
  bookingModalContent: BookingModalContent;
  ariaLabel?: string;
}

const COHORT_VALUE_PATTERN = /^(\d{2})-(\d{2})$/;

function formatCohortLabel(value: string): string {
  const trimmedValue = value.trim();
  const match = COHORT_VALUE_PATTERN.exec(trimmedValue);
  if (!match) {
    return trimmedValue;
  }

  const monthNumber = Number(match[1]);
  const yearSuffix = Number(match[2]);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return trimmedValue;
  }

  if (!Number.isInteger(yearSuffix)) {
    return trimmedValue;
  }

  const year = 2000 + yearSuffix;
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  return `${monthLabel}, ${year}`;
}

function getDefaultCohort(
  cohorts: LandingPageBookingContent['cohorts'],
): LandingPageBookingContent['cohorts'][number] | null {
  const firstAvailableCohort = cohorts.find((cohort) => !cohort.is_fully_booked);
  return firstAvailableCohort ?? cohorts[0] ?? null;
}

export function LandingPageCta({
  locale,
  slug,
  content,
  commonContent,
  bookingContent,
  bookingModalContent,
  ariaLabel,
}: LandingPageCtaProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isThankYouModalOpen, setIsThankYouModalOpen] = useState(false);
  const [reservationSummary, setReservationSummary] =
    useState<ReservationSummary | null>(null);

  const selectedCohort = useMemo(() => {
    return getDefaultCohort(bookingContent.cohorts);
  }, [bookingContent.cohorts]);
  const selectedAgeGroupLabel = selectedCohort?.age_group ?? '';
  const selectedCohortDateLabel = selectedCohort
    ? formatCohortLabel(selectedCohort.cohort)
    : '';
  const selectedCohortDate = selectedCohort?.dates[0]?.start_datetime?.split('T')[0] ?? '';
  const ctaLabel = content.buttonLabel || commonContent.defaultCtaLabel;

  useEffect(() => {
    if (!isPaymentModalOpen || !selectedCohort || selectedCohort.is_fully_booked) {
      return;
    }

    trackAnalyticsEvent('booking_modal_open', {
      sectionId: 'landing-page-cta',
      ctaLocation: 'landing_page',
      params: {
        age_group: selectedAgeGroupLabel,
        cohort_label: selectedCohortDateLabel,
        cohort_date: selectedCohortDate,
      },
    });
  }, [
    isPaymentModalOpen,
    selectedAgeGroupLabel,
    selectedCohort,
    selectedCohortDate,
    selectedCohortDateLabel,
  ]);

  return (
    <>
      <SectionShell
        id='landing-page-cta'
        ariaLabel={ariaLabel ?? content.title}
        dataFigmaNode='landing-page-cta'
        className='es-bg-surface-white'
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
            disabled={!selectedCohort || selectedCohort.is_fully_booked}
            onClick={() => {
              if (!selectedCohort || selectedCohort.is_fully_booked) {
                return;
              }

              trackAnalyticsEvent('landing_page_cta_click', {
                sectionId: 'landing-page-cta',
                ctaLocation: 'landing_page',
                params: {
                  landing_page_slug: slug,
                  age_group: selectedAgeGroupLabel,
                  cohort_label: selectedCohortDateLabel,
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

      {isPaymentModalOpen && (
        <MyBestAuntieBookingModal
          locale={locale}
          modalContent={bookingContent.modal}
          paymentModalContent={bookingModalContent.paymentModal}
          selectedCohort={selectedCohort}
          selectedCohortDateLabel={selectedCohortDateLabel}
          selectedAgeGroupLabel={selectedAgeGroupLabel}
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
        <MyBestAuntieThankYouModal
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
