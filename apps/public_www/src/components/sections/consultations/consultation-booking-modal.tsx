'use client';

import {
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BookingFlowModalShell } from '@/components/sections/booking-modal/booking-flow-modal-shell';
import { BookingEventDetails } from '@/components/sections/booking-modal/event-details';
import { BookingReservationForm } from '@/components/sections/booking-modal/reservation-form';
import type { MetaPixelContentName } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import type {
  BookingPaymentModalContent,
  Locale,
} from '@/content';
import type { ConsultationEventBookingModalPayload } from '@/lib/events-data';
import {
  buildConsultationPickerWeeks,
  collectDistinctHkYearMonthsFromYmds,
  formatConsultationPickerMonthHeading,
  pickDefaultConsultationYmd,
  rebaseConsultationDateParts,
  type ConsultationDayPeriod,
} from '@/lib/consultation-booking-slot';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';
import { mergeClassNames } from '@/lib/class-name-utils';

interface ConsultationBookingModalProps {
  locale?: Locale;
  paymentModalContent: BookingPaymentModalContent;
  bookingPayload: ConsultationEventBookingModalPayload;
  /** Picker labels (AM/PM, weekdays, aria). */
  pickerContent: ConsultationBookingPickerContent;
  analyticsSectionId?: string;
  metaPixelContentName?: MetaPixelContentName;
  captchaWidgetAction?: string;
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

export interface ConsultationBookingPickerContent {
  amLabel: string;
  pmLabel: string;
  monthJoiner: string;
  weekdayShortLabels: [string, string, string, string, string];
  datePickerLegend: string;
  /** Interpolate `{day}` with the calendar day of month (1–31). */
  datePickerDayTemplate: string;
}

function ConsultationDatePickerGrid({
  locale,
  content,
  selectedYmd,
  dayPeriod,
  onSelectYmd,
  onSelectPeriod,
}: {
  locale: Locale;
  content: ConsultationBookingPickerContent;
  selectedYmd: string;
  dayPeriod: ConsultationDayPeriod;
  onSelectYmd: (ymd: string) => void;
  onSelectPeriod: (period: ConsultationDayPeriod) => void;
}) {
  const weeks = useMemo(() => buildConsultationPickerWeeks(), []);

  const monthHeading = useMemo(() => {
    const ymSet = new Set<string>();
    for (const row of weeks) {
      for (const cell of row.days) {
        ymSet.add(cell.ymd);
      }
    }
    const pairs = collectDistinctHkYearMonthsFromYmds([...ymSet]);
    return formatConsultationPickerMonthHeading(pairs, locale, content.monthJoiner);
  }, [weeks, locale, content.monthJoiner]);

  const periodGroupId = useId();
  const gridLabelId = useId();

  return (
    <div data-consultation-date-picker='true'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <p
          className='text-lg font-semibold leading-6 es-text-heading'
          aria-live='polite'
        >
          {monthHeading}
        </p>
        <div className='flex shrink-0 flex-col gap-1'>
          <span className='sr-only' id={periodGroupId}>
            {content.datePickerLegend}
          </span>
          <div
            className='inline-flex rounded-full border border-black/20 p-1 es-bg-surface-muted'
            role='group'
            aria-labelledby={periodGroupId}
          >
            <button
              type='button'
              className={mergeClassNames(
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                dayPeriod === 'am'
                  ? 'es-bg-surface es-text-heading shadow-sm'
                  : 'es-text-body opacity-80',
              )}
              aria-pressed={dayPeriod === 'am'}
              onClick={() => {
                onSelectPeriod('am');
              }}
            >
              {content.amLabel}
            </button>
            <button
              type='button'
              className={mergeClassNames(
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                dayPeriod === 'pm'
                  ? 'es-bg-surface es-text-heading shadow-sm'
                  : 'es-text-body opacity-80',
              )}
              aria-pressed={dayPeriod === 'pm'}
              onClick={() => {
                onSelectPeriod('pm');
              }}
            >
              {content.pmLabel}
            </button>
          </div>
        </div>
      </div>

      <p className='sr-only' id={gridLabelId}>
        {content.datePickerLegend}
      </p>
      <div
        className='mt-6 overflow-x-auto'
        role='grid'
        aria-labelledby={gridLabelId}
      >
        <table className='w-full min-w-[280px] border-collapse text-center'>
          <thead>
            <tr>
              {content.weekdayShortLabels.map((label) => (
                <th
                  key={label}
                  scope='col'
                  className='pb-2 text-xs font-semibold tracking-wide es-text-dim'
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((row, rowIndex) => (
              <tr key={`w-${rowIndex}`} role='row'>
                {row.days.map((cell) => {
                  const isSelected = cell.ymd === selectedYmd;
                  return (
                    <td key={cell.ymd} className='p-1' role='gridcell'>
                      <button
                        type='button'
                        disabled={cell.isDisabled}
                        aria-pressed={isSelected}
                        aria-label={content.datePickerDayTemplate.replace(
                          '{day}',
                          String(cell.dayOfMonth),
                        )}
                        className={mergeClassNames(
                          'flex h-10 w-full min-w-[2.25rem] items-center justify-center rounded-lg text-base font-semibold transition-colors',
                          cell.isDisabled
                            ? 'cursor-not-allowed opacity-30'
                            : 'es-text-heading hover:es-bg-surface-muted',
                          isSelected && !cell.isDisabled
                            ? 'border-2 border-current es-bg-surface'
                            : 'border border-transparent',
                        )}
                        onClick={() => {
                          if (!cell.isDisabled) {
                            onSelectYmd(cell.ymd);
                          }
                        }}
                      >
                        {cell.dayOfMonth}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ConsultationBookingModal({
  locale = 'en',
  paymentModalContent,
  bookingPayload,
  pickerContent,
  analyticsSectionId = 'consultations-booking',
  metaPixelContentName = PIXEL_CONTENT_NAME.consultation_booking,
  captchaWidgetAction = 'consultation_reservation_submit',
  onClose,
  onSubmitReservation,
}: ConsultationBookingModalProps) {
  const topicsFieldConfig = bookingPayload.topicsFieldConfig;
  const modalPanelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  const weeks = useMemo(() => buildConsultationPickerWeeks(), []);
  const defaultYmd = useMemo(() => pickDefaultConsultationYmd(weeks), [weeks]);

  const [selectedYmd, setSelectedYmd] = useState(() => defaultYmd ?? '');
  const [dayPeriod, setDayPeriod] = useState<ConsultationDayPeriod>('am');

  useModalLockBody({ onEscape: onClose });
  useModalFocusManagement({
    isActive: true,
    containerRef: modalPanelRef,
    initialFocusRef: closeButtonRef,
    restoreFocus: true,
  });

  const rebasedParts = useMemo(() => {
    if (!selectedYmd) {
      return bookingPayload.dateParts;
    }
    return rebaseConsultationDateParts(bookingPayload.dateParts, selectedYmd, dayPeriod);
  }, [bookingPayload.dateParts, selectedYmd, dayPeriod]);

  const selectedDateStartTime = rebasedParts[0]?.startDateTime ?? '';

  const pickerSlot = (
    <ConsultationDatePickerGrid
      locale={locale}
      content={pickerContent}
      selectedYmd={selectedYmd}
      dayPeriod={dayPeriod}
      onSelectYmd={setSelectedYmd}
      onSelectPeriod={setDayPeriod}
    />
  );

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
        activePartRows={[]}
        originalAmount={bookingPayload.originalAmount}
        venueName={bookingPayload.locationName}
        venueAddress={bookingPayload.locationAddress}
        directionHref={bookingPayload.directionHref}
        detailsVariant='event'
        consultationScheduleSlot={pickerSlot}
      />
      <BookingReservationForm
        locale={locale}
        content={paymentModalContent}
        eventTitle={bookingPayload.title}
        eventSubtitle={bookingPayload.subtitle}
        courseSessions={rebasedParts.map((part) => {
          return {
            dateStartTime: part.startDateTime,
            dateEndTime: part.endDateTime,
          };
        })}
        selectedAgeGroupLabel=''
        selectedCohortDateLabel={bookingPayload.selectedDateLabel}
        selectedDateStartTime={selectedDateStartTime}
        selectedCohortPrice={bookingPayload.originalAmount}
        venueName={bookingPayload.locationName}
        venueAddress={bookingPayload.locationAddress}
        venueDirectionHref={bookingPayload.directionHref ?? ''}
        dateEndTime={rebasedParts[0]?.endDateTime ?? ''}
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
