'use client';

import {
  useId,
  useMemo,
  useRef,
} from 'react';

import { BookingFlowModalShell } from '@/components/sections/booking-modal/booking-flow-modal-shell';
import {
  type BookingEventDetailPart,
  BookingEventDetails,
} from '@/components/sections/booking-modal/event-details';
import { BookingReservationForm } from '@/components/sections/booking-modal/reservation-form';
import type { MetaPixelContentName } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import type {
  BookingTopicsFieldConfig,
  ReservationSummary,
} from '@/components/sections/booking-modal/types';
import type {
  BookingPaymentModalContent,
  Locale,
} from '@/content';
import type { EventBookingModalPayload } from '@/lib/events-data';
import { formatPartDateTimeLabel } from '@/lib/format';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';

interface EventBookingModalProps {
  locale?: Locale;
  paymentModalContent: BookingPaymentModalContent;
  bookingPayload: EventBookingModalPayload;
  topicsFieldConfig?: BookingTopicsFieldConfig;
  analyticsSectionId?: string;
  metaPixelContentName?: MetaPixelContentName;
  captchaWidgetAction?: string;
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

export function EventBookingModal({
  locale = 'en',
  paymentModalContent,
  bookingPayload,
  topicsFieldConfig: topicsFieldConfigProp,
  analyticsSectionId = 'events-booking',
  metaPixelContentName = PIXEL_CONTENT_NAME.event_booking,
  captchaWidgetAction = 'event_reservation_submit',
  onClose,
  onSubmitReservation,
}: EventBookingModalProps) {
  const topicsFieldConfig = topicsFieldConfigProp ?? bookingPayload.topicsFieldConfig;
  const modalPanelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  useModalLockBody({ onEscape: onClose });
  useModalFocusManagement({
    isActive: true,
    containerRef: modalPanelRef,
    initialFocusRef: closeButtonRef,
    restoreFocus: true,
  });

  const activePartRows = useMemo<BookingEventDetailPart[]>(() => {
    return bookingPayload.dateParts.map((part) => {
      return {
        date: formatPartDateTimeLabel(part.startDateTime, locale),
        description: part.description,
      };
    });
  }, [bookingPayload.dateParts, locale]);

  return (
    <BookingFlowModalShell
      paymentModalContent={paymentModalContent}
      modalPanelRef={modalPanelRef}
      closeButtonRef={closeButtonRef}
      dialogTitleId={dialogTitleId}
      dialogDescriptionId={dialogDescriptionId}
      onClose={onClose}
    >
      <BookingEventDetails
        locale={locale}
        headingId={dialogTitleId}
        title={bookingPayload.title}
        subtitle={bookingPayload.subtitle}
        content={paymentModalContent}
        activePartRows={activePartRows}
        originalAmount={bookingPayload.originalAmount}
        venueName={bookingPayload.locationName}
        venueAddress={bookingPayload.locationAddress}
        directionHref={bookingPayload.directionHref}
        detailsVariant='event'
      />
      <BookingReservationForm
        locale={locale}
        content={paymentModalContent}
        eventTitle={bookingPayload.title}
        serviceKey={bookingPayload.serviceKey ?? ''}
        courseSlug='event-booking'
        eventSubtitle={bookingPayload.subtitle}
        courseSessions={bookingPayload.dateParts.map((part) => {
          return {
            dateStartTime: part.startDateTime,
            dateEndTime: part.endDateTime,
          };
        })}
        selectedAgeGroupLabel=''
        selectedCohortDateLabel={bookingPayload.selectedDateLabel}
        selectedDateStartTime={bookingPayload.selectedDateStartTime}
        selectedCohortPrice={bookingPayload.originalAmount}
        venueName={bookingPayload.locationName}
        venueAddress={bookingPayload.locationAddress}
        venueDirectionHref={bookingPayload.directionHref ?? ''}
        dateEndTime={bookingPayload.dateParts[0]?.endDateTime ?? ''}
        topicsFieldConfig={topicsFieldConfig}
        topicsPrefill={bookingPayload.topicsPrefill}
        descriptionId={dialogDescriptionId}
        analyticsSectionId={analyticsSectionId}
        metaPixelContentName={metaPixelContentName}
        captchaWidgetAction={captchaWidgetAction}
        onSubmitReservation={onSubmitReservation}
      />
    </BookingFlowModalShell>
  );
}
