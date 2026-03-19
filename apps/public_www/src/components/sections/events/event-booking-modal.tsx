'use client';

import {
  useId,
  useMemo,
  useRef,
} from 'react';

import {
  OverlayDialogPanel,
  OverlayScrollableBody,
} from '@/components/shared/overlay-surface';
import {
  CloseButton,
  ModalOverlay,
} from '@/components/sections/booking-modal/shared';
import {
  type BookingEventDetailPart,
  BookingEventDetails,
} from '@/components/sections/booking-modal/event-details';
import { BookingReservationForm } from '@/components/sections/booking-modal/reservation-form';
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
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

export function EventBookingModal({
  locale = 'en',
  paymentModalContent,
  bookingPayload,
  topicsFieldConfig,
  onClose,
  onSubmitReservation,
}: EventBookingModalProps) {
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
        date: formatPartDateTimeLabel(part.startDateTime),
        description: part.description,
      };
    });
  }, [bookingPayload.dateParts]);

  return (
    <ModalOverlay
      onClose={onClose}
      overlayAriaLabel={paymentModalContent.closeOverlayLabel}
    >
      <OverlayDialogPanel
        panelRef={modalPanelRef}
        ariaLabelledBy={dialogTitleId}
        ariaDescribedBy={dialogDescriptionId}
        tabIndex={-1}
        className='es-my-best-auntie-booking-modal-panel overflow-visible'
      >
        <header className='flex justify-end px-4 pb-8 pt-6 sm:px-8 sm:pt-7'>
          <CloseButton
            label={paymentModalContent.closeLabel}
            onClose={onClose}
            buttonRef={closeButtonRef}
          />
        </header>
        <OverlayScrollableBody className='pb-5 sm:pb-8'>
          <div className='relative z-10 flex flex-col gap-8 pb-9 lg:flex-row lg:gap-10 lg:pb-[72px]'>
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
              selectedAgeGroupLabel=''
              selectedCohortDateLabel={bookingPayload.selectedDateLabel}
              selectedDateStartTime={bookingPayload.selectedDateStartTime}
              selectedCohortPrice={bookingPayload.originalAmount}
              topicsFieldConfig={topicsFieldConfig}
              descriptionId={dialogDescriptionId}
              analyticsSectionId='events-booking'
              metaPixelContentName='event_booking'
              captchaWidgetAction='event_reservation_submit'
              onSubmitReservation={onSubmitReservation}
            />
          </div>
        </OverlayScrollableBody>
      </OverlayDialogPanel>
    </ModalOverlay>
  );
}
