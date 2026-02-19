'use client';

import Image from 'next/image';
import {
  useId,
  useMemo,
  useRef,
  useState,
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
import type { MyBestAuntieBookingContent } from '@/content';
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
  packageLabel: string;
  monthLabel: string;
  paymentMethod: string;
  totalAmount: number;
  courseLabel: string;
  scheduleDateLabel?: string;
  scheduleTimeLabel?: string;
}

interface MyBestAuntieBookingModalProps {
  content: MyBestAuntieBookingContent['paymentModal'];
  initialMonthId?: string;
  selectedAgeGroupLabel?: string;
  learnMoreLabel?: string;
  learnMoreHref?: string;
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

export function MyBestAuntieBookingModal({
  content,
  initialMonthId,
  selectedAgeGroupLabel = '',
  learnMoreLabel = '',
  learnMoreHref = '#',
  onClose,
  onSubmitReservation,
}: MyBestAuntieBookingModalProps) {
  const firstMonthId = content.monthOptions[0]?.id ?? '';
  const firstPackageId = content.packageOptions[0]?.id ?? '';
  const resolvedMonthId = content.monthOptions.some(
    (option) => option.id === initialMonthId,
  )
    ? (initialMonthId ?? firstMonthId)
    : firstMonthId;

  const [selectedMonthId] = useState(resolvedMonthId);
  const [selectedPackageId] = useState(firstPackageId);
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

  const selectedMonth =
    content.monthOptions.find((option) => option.id === selectedMonthId) ??
    content.monthOptions[0];
  const selectedPackage =
    content.packageOptions.find((option) => option.id === selectedPackageId) ??
    content.packageOptions[0];

  const originalAmount = selectedPackage?.price ?? 0;

  const activePartRows = useMemo<BookingEventDetailPart[]>(() => {
    const activeMonthId = selectedMonth?.id ?? '';

    return content.parts.map((part) => {
      const matchedDateEntry = Object.entries(part.dateByMonth).find(
        ([monthId]) => monthId === activeMonthId,
      );

      return {
        label: part.label,
        date: matchedDateEntry?.[1] ?? '',
        description: part.description,
      };
    });
  }, [content.parts, selectedMonth?.id]);

  const selectedTimeLabel = useMemo(() => {
    return extractTimeRangeFromPartDate(activePartRows[0]?.date ?? '');
  }, [activePartRows]);

  return (
    <ModalOverlay onClose={onClose}>
      <OverlayDialogPanel
        panelRef={modalPanelRef}
        ariaLabelledBy={dialogTitleId}
        ariaDescribedBy={dialogDescriptionId}
        tabIndex={-1}
        className='es-my-best-auntie-booking-modal-panel'
      >
        <header className='flex justify-end px-4 pb-8 pt-6 sm:px-8 sm:pt-7'>
          <CloseButton
            label={content.closeLabel}
            onClose={onClose}
            buttonRef={closeButtonRef}
          />
        </header>
        <OverlayScrollableBody className='pb-5 sm:pb-8'>
          <Image
            src='/images/evolvesprouts-logo.svg'
            alt=''
            width={446}
            height={592}
            className='pointer-events-none absolute left-0 top-0 hidden w-[250px] -translate-y-12 lg:block'
            aria-hidden='true'
          />

          <div className='relative z-10 flex flex-col gap-8 pb-9 lg:flex-row lg:gap-10 lg:pb-[72px]'>
            <BookingEventDetails
              headingId={dialogTitleId}
              content={content}
              activePartRows={activePartRows}
              originalAmount={originalAmount}
              learnMoreLabel={learnMoreLabel}
              learnMoreHref={learnMoreHref}
            />
            <BookingReservationForm
              content={content}
              selectedAgeGroupLabel={selectedAgeGroupLabel}
              selectedMonthLabel={selectedMonth?.label ?? ''}
              selectedPackageLabel={selectedPackage?.label ?? ''}
              selectedPackagePrice={originalAmount}
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
