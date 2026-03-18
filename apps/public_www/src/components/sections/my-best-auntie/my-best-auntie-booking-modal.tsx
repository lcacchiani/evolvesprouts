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
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import type {
  BookingPaymentModalContent,
  Locale,
  MyBestAuntieBookingContent,
  MyBestAuntieModalContent,
} from '@/content';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';

interface MyBestAuntieBookingModalProps {
  locale?: Locale;
  modalContent: MyBestAuntieModalContent;
  paymentModalContent: BookingPaymentModalContent;
  selectedCohort: MyBestAuntieBookingContent['cohorts'][number] | null;
  selectedCohortDateLabel?: string;
  selectedAgeGroupLabel?: string;
  analyticsSectionId?: string;
  metaPixelContentName?: string;
  captchaWidgetAction?: string;
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

const COHORT_VALUE_PATTERN = /^(\d{2})-(\d{2})$/;

function formatCohortValue(value: string): string {
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

function formatPartDateTimeLabel(startDateTime: string): string {
  const date = new Date(startDateTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = new Intl.DateTimeFormat('en-US', {
    month: 'short',
  }).format(date);
  const day = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(' AM', ' am')
    .replace(' PM', ' pm');

  return `${month} ${day} @ ${time}`;
}

export function MyBestAuntieBookingModal({
  locale = 'en',
  modalContent,
  paymentModalContent,
  selectedCohort,
  selectedCohortDateLabel = '',
  selectedAgeGroupLabel = '',
  analyticsSectionId = 'my-best-auntie-booking',
  metaPixelContentName = 'my_best_auntie',
  captchaWidgetAction = 'mba_reservation_submit',
  onClose,
  onSubmitReservation,
}: MyBestAuntieBookingModalProps) {
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

  const originalAmount = selectedCohort?.price ?? 0;

  const activePartRows = useMemo<BookingEventDetailPart[]>(() => {
    const summaries = modalContent.partSummaries ?? [];
    return (selectedCohort?.dates ?? []).map((part, index) => {
      return {
        date: formatPartDateTimeLabel(part.start_datetime),
        description: summaries[index] ?? '',
      };
    });
  }, [selectedCohort, modalContent.partSummaries]);

  const selectedDateStartTime = selectedCohort?.dates[0]?.start_datetime ?? '';
  const selectedCohortDateLabelText =
    selectedCohortDateLabel || formatCohortValue(selectedCohort?.cohort ?? '');
  const selectedVenueName = '';
  const selectedVenueAddress = selectedCohort?.location_address ?? '';
  const selectedVenueDirectionHref = selectedCohort?.location_url ?? '#';

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
              title={modalContent.title}
              subtitle={modalContent.subtitle}
              content={paymentModalContent}
              activePartRows={activePartRows}
              originalAmount={originalAmount}
              venueName={selectedVenueName}
              venueAddress={selectedVenueAddress}
              directionHref={selectedVenueDirectionHref}
            />
            <BookingReservationForm
              locale={locale}
              content={paymentModalContent}
              eventTitle={modalContent.title}
              selectedAgeGroupLabel={selectedAgeGroupLabel}
              selectedCohortDateLabel={selectedCohortDateLabelText}
              selectedDateStartTime={selectedDateStartTime}
              selectedCohortPrice={originalAmount}
              descriptionId={dialogDescriptionId}
              analyticsSectionId={analyticsSectionId}
              metaPixelContentName={metaPixelContentName}
              captchaWidgetAction={captchaWidgetAction}
              onSubmitReservation={onSubmitReservation}
            />
          </div>

        </OverlayScrollableBody>
      </OverlayDialogPanel>
    </ModalOverlay>
  );
}

export { MyBestAuntieThankYouModal } from '@/components/sections/booking-modal/thank-you-modal';
