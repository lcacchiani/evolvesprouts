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
import { formatContentTemplate } from '@/content/content-field-utils';
import {
  formatCohortValue,
  formatPartDateTimeLabel,
} from '@/lib/format';
import { formatMyBestAuntiePhaseWindowDateLabels } from '@/lib/site-datetime';
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
    return (selectedCohort?.dates ?? []).map((part) => {
      const phaseWindow = formatMyBestAuntiePhaseWindowDateLabels(
        part.start_datetime,
        locale,
      );
      const dateLabel =
        phaseWindow !== null
          ? formatContentTemplate(modalContent.weekRangeHeadlineTemplate, {
              startDate: phaseWindow.startLabel,
              endDate: phaseWindow.endLabel,
            })
          : formatPartDateTimeLabel(part.start_datetime, locale);
      const groupSessionDateTime = formatPartDateTimeLabel(
        part.start_datetime,
        locale,
      );
      const description = formatContentTemplate(
        modalContent.partScheduleBlockTemplate,
        {
          groupSessionDateTime,
        },
      );
      return {
        date: dateLabel,
        description,
      };
    });
  }, [selectedCohort, modalContent.weekRangeHeadlineTemplate, modalContent.partScheduleBlockTemplate, locale]);

  const selectedDateStartTime = selectedCohort?.dates[0]?.start_datetime ?? '';
  const selectedDateEndTime = selectedCohort?.dates[0]?.end_datetime ?? '';
  const selectedCohortDateLabelText =
    selectedCohortDateLabel || formatCohortValue(selectedCohort?.cohort ?? '', locale);
  const selectedVenueName = selectedCohort?.location_name ?? '';
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
              detailsVariant='my-best-auntie'
            />
            <BookingReservationForm
              locale={locale}
              content={paymentModalContent}
              eventTitle={modalContent.title}
              eventSubtitle={modalContent.subtitle}
              courseSessions={(selectedCohort?.dates ?? []).map((part) => {
                return {
                  dateStartTime: part.start_datetime,
                  dateEndTime: part.end_datetime,
                };
              })}
              selectedAgeGroupLabel={selectedAgeGroupLabel}
              selectedCohortDateLabel={selectedCohortDateLabelText}
              selectedDateStartTime={selectedDateStartTime}
              selectedCohortPrice={originalAmount}
              venueName={selectedVenueName}
              venueAddress={selectedVenueAddress}
              venueDirectionHref={selectedVenueDirectionHref}
              dateEndTime={selectedDateEndTime}
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
