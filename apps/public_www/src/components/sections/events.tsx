'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import {
  EventCardsList,
  EventsLoadingState,
  useEventCards,
} from '@/components/sections/shared/events-shared';
import type {
  BookingModalContent,
  EventsContent,
  Locale,
  MyBestAuntieModalContent,
} from '@/content';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { sortUpcomingEvents } from '@/lib/events-data';
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

interface EventsProps {
  content: EventsContent;
  bookingModalContent: BookingModalContent;
  myBestAuntieModalContent: MyBestAuntieModalContent;
  locale?: Locale;
  thankYouWhatsappHref?: string;
  thankYouWhatsappCtaLabel?: string;
}

export function Events({
  content,
  bookingModalContent,
  myBestAuntieModalContent,
  locale = 'en',
  thankYouWhatsappHref,
  thankYouWhatsappCtaLabel,
}: EventsProps) {
  const [activeBookingEventId, setActiveBookingEventId] = useState('');
  const [reservationSummary, setReservationSummary] =
    useState<ReservationSummary | null>(null);
  const [activeThankYouModalVariant, setActiveThankYouModalVariant] = useState<
    'event' | 'my-best-auntie' | ''
  >('');
  const {
    visibleEvents,
    isLoading,
    hasRequestError,
  } = useEventCards({
    content,
    locale,
    sortEventCards: sortUpcomingEvents,
  });
  const activeBookingEvent = visibleEvents.find((event) => event.id === activeBookingEventId)
    ?? null;
  const activeBookingPayload = activeBookingEvent?.bookingModalPayload;
  const isThankYouModalOpen = activeThankYouModalVariant !== '';

  useEffect(() => {
    if (!isThankYouModalOpen || !reservationSummary) {
      return;
    }

    trackAnalyticsEvent('booking_thank_you_view', {
      sectionId: 'events-booking',
      ctaLocation: 'thank_you_modal',
      params: {
        payment_method: reservationSummary.paymentMethod,
        total_amount: reservationSummary.totalAmount,
        age_group: reservationSummary.ageGroup ?? '',
        cohort_date: reservationSummary.dateStartTime?.split('T')[0] ?? '',
      },
    });
  }, [isThankYouModalOpen, reservationSummary]);

  function handleOpenBookingModal(eventId: string) {
    const nextActiveEvent = visibleEvents.find((event) => event.id === eventId);
    const nextBookingPayload = nextActiveEvent?.bookingModalPayload;
    if (!nextActiveEvent || !nextBookingPayload || nextActiveEvent.status === 'fully_booked') {
      return;
    }

    trackAnalyticsEvent('booking_modal_open', {
      sectionId: 'events-booking',
      ctaLocation: 'events_section',
      params: {
        age_group: nextBookingPayload.variant === 'my-best-auntie'
          ? nextBookingPayload.selectedAgeGroupLabel
          : '',
        cohort_label: nextBookingPayload.variant === 'my-best-auntie'
          ? nextBookingPayload.selectedCohortDateLabel
          : nextBookingPayload.selectedDateLabel,
        cohort_date: nextBookingPayload.variant === 'my-best-auntie'
          ? (nextBookingPayload.selectedCohort.dates[0]?.start_datetime?.split('T')[0] ?? '')
          : (nextBookingPayload.selectedDateStartTime.split('T')[0] ?? ''),
      },
    });
    trackMetaPixelEvent('InitiateCheckout', {
      content_name: nextBookingPayload.variant === 'event' ? 'event_booking' : 'my_best_auntie',
    });
    setActiveBookingEventId(nextActiveEvent.id);
  }

  return (
    <>
      <SectionShell
        id='events'
        ariaLabel={content.title}
        dataFigmaNode='events'
        className='es-events-section pt-0 sm:pt-[60px]'
      >
        <SectionContainer>
          <SectionHeader
            title={content.title}
            titleAs='h1'
            description={content.description}
            descriptionClassName='es-type-body mt-4'
          />
          <div className='mt-10 sm:mt-12'>
            {isLoading ? (
              <EventsLoadingState
                label={content.loadingLabel}
                testId='events-loading-gear'
              />
            ) : visibleEvents.length === 0 ? (
              <div className='rounded-panel border es-border-event-card es-bg-surface-event-card px-5 py-7 text-center sm:px-8 sm:py-10'>
                <p className='es-events-card-body'>{content.emptyStateLabel}</p>
                {hasRequestError && (
                  <p className='mt-3 text-sm text-black/60'>{content.errorLabel}</p>
                )}
              </div>
            ) : (
              <EventCardsList
                content={content}
                events={visibleEvents}
                onOpenBookingModal={(eventCard) => {
                  handleOpenBookingModal(eventCard.id);
                }}
              />
            )}
          </div>
        </SectionContainer>
      </SectionShell>

      {activeBookingPayload?.variant === 'event' && (
        <EventBookingModal
          locale={locale}
          paymentModalContent={bookingModalContent.paymentModal}
          bookingPayload={activeBookingPayload}
          onClose={() => {
            setActiveBookingEventId('');
          }}
          onSubmitReservation={(summary) => {
            setReservationSummary(summary);
            setActiveBookingEventId('');
            setActiveThankYouModalVariant('event');
          }}
        />
      )}

      {activeBookingPayload?.variant === 'my-best-auntie' && (
        <MyBestAuntieBookingModal
          locale={locale}
          modalContent={myBestAuntieModalContent}
          paymentModalContent={bookingModalContent.paymentModal}
          selectedCohort={activeBookingPayload.selectedCohort}
          selectedCohortDateLabel={activeBookingPayload.selectedCohortDateLabel}
          selectedAgeGroupLabel={activeBookingPayload.selectedAgeGroupLabel}
          analyticsSectionId='events-booking'
          metaPixelContentName='my_best_auntie'
          captchaWidgetAction='events_mba_reservation_submit'
          onClose={() => {
            setActiveBookingEventId('');
          }}
          onSubmitReservation={(summary) => {
            setReservationSummary(summary);
            setActiveBookingEventId('');
            setActiveThankYouModalVariant('my-best-auntie');
          }}
        />
      )}

      {isThankYouModalOpen && activeThankYouModalVariant === 'event' && (
        <EventThankYouModal
          locale={locale}
          content={bookingModalContent.thankYouModal}
          summary={reservationSummary}
          whatsappHref={thankYouWhatsappHref}
          whatsappCtaLabel={thankYouWhatsappCtaLabel}
          onClose={() => {
            setActiveThankYouModalVariant('');
          }}
        />
      )}

      {isThankYouModalOpen && activeThankYouModalVariant === 'my-best-auntie' && (
        <MyBestAuntieThankYouModal
          locale={locale}
          content={bookingModalContent.thankYouModal}
          summary={reservationSummary}
          whatsappHref={thankYouWhatsappHref}
          whatsappCtaLabel={thankYouWhatsappCtaLabel}
          onClose={() => {
            setActiveThankYouModalVariant('');
          }}
        />
      )}
    </>
  );
}
