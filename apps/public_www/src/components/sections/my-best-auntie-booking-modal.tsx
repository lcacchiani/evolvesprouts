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
import type { Locale, MyBestAuntieBookingContent } from '@/content';
import {
  extractTimeRangeFromPartDate,
} from '@/components/sections/booking-modal/helpers';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';

export interface ReservationSummary {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  childAgeGroup: string;
  paymentMethod: string;
  totalAmount: number;
  courseLabel: string;
  scheduleDateLabel?: string;
  scheduleTimeLabel?: string;
}

interface MyBestAuntieBookingModalProps {
  locale?: Locale;
  content: MyBestAuntieBookingContent['paymentModal'];
  selectedCohort: MyBestAuntieBookingContent['cohorts'][number] | null;
  selectedAgeGroupLabel?: string;
  learnMoreLabel?: string;
  learnMoreHref?: string;
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

export function MyBestAuntieBookingModal({
  locale = 'en',
  content,
  selectedCohort,
  selectedAgeGroupLabel = '',
  learnMoreLabel = '',
  learnMoreHref = '#',
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
    return (selectedCohort?.sessions ?? []).map((part) => {
      return {
        date: part.dateTimeLabel,
        description: part.description,
      };
    });
  }, [selectedCohort]);

  const selectedTimeLabel = useMemo(() => {
    return extractTimeRangeFromPartDate(activePartRows[0]?.date ?? '');
  }, [activePartRows]);
  const selectedCohortDate = selectedCohort?.sessions[0]?.isoDate ?? '';
  const selectedCohortDateLabel = selectedCohort?.dateLabel ?? '';
  const selectedVenueName = selectedCohort?.venue.name ?? '';
  const selectedVenueAddress = selectedCohort?.venue.address ?? '';
  const selectedVenueDirectionHref = selectedCohort?.venue.directionHref ?? '#';

  return (
    <ModalOverlay onClose={onClose}>
      <OverlayDialogPanel
        panelRef={modalPanelRef}
        ariaLabelledBy={dialogTitleId}
        ariaDescribedBy={dialogDescriptionId}
        tabIndex={-1}
        className='es-my-best-auntie-booking-modal-panel overflow-visible'
      >
        <header className='flex justify-end px-4 pb-8 pt-6 sm:px-8 sm:pt-7'>
          <CloseButton
            label={content.closeLabel}
            onClose={onClose}
            buttonRef={closeButtonRef}
          />
        </header>
        <OverlayScrollableBody className='pb-5 sm:pb-8'>
          <div className='relative z-10 flex flex-col gap-8 pb-9 lg:flex-row lg:gap-10 lg:pb-[72px]'>
            <BookingEventDetails
              locale={locale}
              headingId={dialogTitleId}
              content={content}
              activePartRows={activePartRows}
              originalAmount={originalAmount}
              venueName={selectedVenueName}
              venueAddress={selectedVenueAddress}
              directionHref={selectedVenueDirectionHref}
              learnMoreLabel={learnMoreLabel}
              learnMoreHref={learnMoreHref}
            />
            <BookingReservationForm
              locale={locale}
              content={content}
              selectedAgeGroupLabel={selectedAgeGroupLabel}
              selectedCohortDateLabel={selectedCohortDateLabel}
              selectedCohortDate={selectedCohortDate}
              selectedCohortPrice={originalAmount}
              scheduleTimeLabel={selectedTimeLabel}
              descriptionId={dialogDescriptionId}
              onSubmitReservation={onSubmitReservation}
            />
          </div>

        </OverlayScrollableBody>
      </OverlayDialogPanel>
    </ModalOverlay>
  );
}

export { MyBestAuntieThankYouModal } from '@/components/sections/booking-modal/thank-you-modal';
