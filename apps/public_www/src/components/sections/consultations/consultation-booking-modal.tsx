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
import type { CalendarAvailabilityPayload } from '@/lib/calendar-availability';
import { buildUnavailableSlotMap } from '@/lib/calendar-availability';
import type { ConsultationEventBookingModalPayload } from '@/lib/events-data';
import {
  buildConsultationPickerWeeks,
  collectDistinctYearMonthsFromYmds,
  firstSelectableConsultationPeriod,
  formatConsultationPickerMonthHeading,
  isConsultationPeriodBlocked,
  pickDefaultConsultationSelection,
  rebaseConsultationDateParts,
  resolveDefaultDateTimeZone,
  type ConsultationDayPeriod,
  type ConsultationUnavailableByYmd,
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
  /** Unavailability list (from JSON now; API later). Dates are YYYY-MM-DD. */
  calendarAvailability: CalendarAvailabilityPayload;
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
  /** Interpolate `{day}`; use when the day is unavailable (past or fully blocked). */
  datePickerUnavailableDayTemplate: string;
}

function ConsultationDatePickerGrid({
  locale,
  content,
  timeZone,
  unavailableByYmd,
  selectedYmd,
  dayPeriod,
  onSelectYmd,
  onSelectPeriod,
}: {
  locale: Locale;
  content: ConsultationBookingPickerContent;
  timeZone: string;
  unavailableByYmd: ConsultationUnavailableByYmd;
  selectedYmd: string;
  dayPeriod: ConsultationDayPeriod;
  onSelectYmd: (ymd: string) => void;
  onSelectPeriod: (period: ConsultationDayPeriod) => void;
}) {
  const weeks = useMemo(() => {
    return buildConsultationPickerWeeks(timeZone, unavailableByYmd);
  }, [timeZone, unavailableByYmd]);

  const monthHeading = useMemo(() => {
    const ymSet = new Set<string>();
    for (const row of weeks) {
      for (const cell of row.days) {
        ymSet.add(cell.ymd);
      }
    }
    const pairs = collectDistinctYearMonthsFromYmds([...ymSet]);
    return formatConsultationPickerMonthHeading(pairs, locale, content.monthJoiner, timeZone);
  }, [weeks, locale, content.monthJoiner, timeZone]);

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
              disabled={
                !selectedYmd ||
                isConsultationPeriodBlocked(selectedYmd, 'am', unavailableByYmd)
              }
              className={mergeClassNames(
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                !selectedYmd || isConsultationPeriodBlocked(selectedYmd, 'am', unavailableByYmd)
                  ? 'cursor-not-allowed opacity-40'
                  : dayPeriod === 'am'
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
              disabled={
                !selectedYmd ||
                isConsultationPeriodBlocked(selectedYmd, 'pm', unavailableByYmd)
              }
              className={mergeClassNames(
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                !selectedYmd || isConsultationPeriodBlocked(selectedYmd, 'pm', unavailableByYmd)
                  ? 'cursor-not-allowed opacity-40'
                  : dayPeriod === 'pm'
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
                  const ariaDayLabel = cell.isDisabled
                    ? content.datePickerUnavailableDayTemplate.replace(
                        '{day}',
                        String(cell.dayOfMonth),
                      )
                    : content.datePickerDayTemplate.replace(
                        '{day}',
                        String(cell.dayOfMonth),
                      );
                  return (
                    <td key={cell.ymd} className='p-1' role='gridcell'>
                      <button
                        type='button'
                        disabled={cell.isDisabled}
                        aria-pressed={isSelected}
                        aria-label={ariaDayLabel}
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
  calendarAvailability,
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

  const timeZone = useMemo(() => resolveDefaultDateTimeZone(), []);

  const unavailableByYmd = useMemo(() => {
    return buildUnavailableSlotMap(calendarAvailability.unavailable_slots);
  }, [calendarAvailability.unavailable_slots]);

  const defaultSelection = useMemo(() => {
    const weeks = buildConsultationPickerWeeks(timeZone, unavailableByYmd);
    return pickDefaultConsultationSelection(weeks, unavailableByYmd);
  }, [timeZone, unavailableByYmd]);

  const [pickerSelection, setPickerSelection] = useState<{
    ymd: string;
    period: ConsultationDayPeriod;
  } | null>(null);

  const selectedYmd = pickerSelection?.ymd ?? defaultSelection?.ymd ?? '';
  const dayPeriod = pickerSelection?.period ?? defaultSelection?.period ?? 'am';

  function handleSelectYmd(ymd: string) {
    const period = firstSelectableConsultationPeriod(ymd, unavailableByYmd);
    if (period) {
      setPickerSelection({ ymd, period });
    }
  }

  function handleSelectPeriod(period: ConsultationDayPeriod) {
    if (!selectedYmd || isConsultationPeriodBlocked(selectedYmd, period, unavailableByYmd)) {
      return;
    }
    setPickerSelection({ ymd: selectedYmd, period });
  }

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
    return rebaseConsultationDateParts(
      bookingPayload.dateParts,
      selectedYmd,
      dayPeriod,
      timeZone,
    );
  }, [bookingPayload.dateParts, selectedYmd, dayPeriod, timeZone]);

  const selectedDateStartTime = rebasedParts[0]?.startDateTime ?? '';

  const pickerSlot = (
    <ConsultationDatePickerGrid
      locale={locale}
      content={pickerContent}
      timeZone={timeZone}
      unavailableByYmd={unavailableByYmd}
      selectedYmd={selectedYmd}
      dayPeriod={dayPeriod}
      onSelectYmd={handleSelectYmd}
      onSelectPeriod={handleSelectPeriod}
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
