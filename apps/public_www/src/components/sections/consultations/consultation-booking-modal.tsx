'use client';

import {
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BookingFlowModalShell } from '@/components/sections/booking-modal/booking-flow-modal-shell';
import { useBookingModalScaffold } from '@/components/sections/booking-modal/use-booking-modal-scaffold';
import { BookingEventDetails } from '@/components/sections/booking-modal/event-details';
import { BookingReservationForm } from '@/components/sections/booking-modal/reservation-form';
import type { MetaPixelContentName } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import type {
  BookingThankYouRecapLabelTemplates,
  ReservationSummary,
} from '@/components/sections/booking-modal/types';
import type {
  BookingPaymentModalContent,
  Locale,
} from '@/content';
import type { CalendarAvailabilityPayload } from '@/lib/calendar-availability';
import { buildUnavailableSlotMap } from '@/lib/calendar-availability';
import {
  CONSULTATION_BOOKING_SYSTEM,
  type ConsultationEventBookingModalPayload,
} from '@/lib/events-data';
import {
  buildConsultationPickerWeeks,
  collectDistinctYearMonthsFromYmds,
  firstSelectableConsultationPeriod,
  formatConsultationPickerMonthHeading,
  formatConsultationSelectedSlotSummary,
  isConsultationPeriodBlocked,
  pickDefaultConsultationSelection,
  rebaseConsultationDateParts,
  type ConsultationDayPeriod,
  type ConsultationUnavailableByYmd,
} from '@/lib/consultation-booking-slot';
import { PUBLIC_SITE_IANA_TIMEZONE } from '@/lib/site-datetime';
import { formatSlotDayAriaLabel } from '@/components/sections/shared/slot-picker-helpers';
import { mergeClassNames } from '@/lib/class-name-utils';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SectionSpinnerStatus } from '@/components/shared/section-spinner-status';

/** Matches `consultations-booking` level feature list (discs + orange markers via CSS). */
const CONSULTATION_MODAL_LEVEL_FEATURES_LIST_CLASSNAME =
  'es-consultations-booking-level-features mt-3 w-full min-w-0 list-disc space-y-2 ps-5 text-left';
const CONSULTATION_MODAL_LEVEL_FEATURE_LINE_CLASSNAME = 'es-type-body es-text-dim';

export interface ConsultationBookingModalSelectionInfo {
  focusLabel: string;
  levelId: string;
  /** Level display title for confirmation email Details row. */
  levelLabel: string;
  levelFeatures: string[];
  focusLabelFormatted: string;
  upgradeToDeepDiveLabel: string;
}

interface ConsultationBookingModalProps {
  locale?: Locale;
  paymentModalContent: BookingPaymentModalContent;
  bookingPayload: ConsultationEventBookingModalPayload;
  /** Picker labels (AM/PM, weekdays, aria). */
  pickerContent: ConsultationBookingPickerContent;
  /** Unavailability list from merged manual + session blockers. Dates are YYYY-MM-DD. */
  calendarAvailability: CalendarAvailabilityPayload;
  /** Blocker fetch lifecycle from the parent (public API). */
  calendarBlockersStatus?: 'idle' | 'loading' | 'ready' | 'error';
  /** Locale string while blockers are loading (`calendarBlockersStatus === 'loading'`). */
  calendarBlockersLoadingMessage?: string;
  /** Locale string when the blockers request failed (`calendarBlockersStatus === 'error'`). */
  calendarBlockersErrorMessage?: string;
  /** Selection context: focus label, level features, upgrade label. */
  selectionInfo?: ConsultationBookingModalSelectionInfo;
  /**
   * Increment when the user upgrades from essentials to deep-dive (e.g. parent
   * `setState` in the upgrade handler) so the feature list can play the same
   * enter animation as the booking section. Reset when the modal closes.
   */
  levelFeaturesEnterAnimationNonce?: number;
  analyticsSectionId?: string;
  metaPixelContentName?: MetaPixelContentName;
  captchaWidgetAction?: string;
  thankYouRecapLabels?: BookingThankYouRecapLabelTemplates;
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
  /** Called when user clicks the "Upgrade to Deep Dive" CTA in the modal. */
  onUpgradeToDeepDive?: () => void;
}

export interface ConsultationBookingPickerContent {
  pickDateTimeIntro: string;
  amLabel: string;
  pmLabel: string;
  monthJoiner: string;
  weekdayShortLabels: [string, string, string, string, string];
  datePickerLegend: string;
  /** Interpolate `{day}` with the calendar day of month (1-31). */
  datePickerDayTemplate: string;
  /** Interpolate `{day}`; use when the day is unavailable (past or fully blocked). */
  datePickerUnavailableDayTemplate: string;
  /** Interpolate `{day}` when the grid is disabled because availability is still loading. */
  datePickerLoadingDayTemplate: string;
  /** Shown under the selected date summary; same tone as payment modal refund hint. */
  dateConfirmationNote: string;
}

function ConsultationDatePickerGrid({
  locale,
  content,
  timeZone,
  unavailableByYmd,
  selectedYmd,
  dayPeriod,
  interactionDisabled,
  onSelectYmd,
  onSelectPeriod,
}: {
  locale: Locale;
  content: ConsultationBookingPickerContent;
  timeZone: string;
  unavailableByYmd: ConsultationUnavailableByYmd;
  selectedYmd: string;
  dayPeriod: ConsultationDayPeriod;
  /** When true, day and period controls are disabled (e.g. while blockers load). */
  interactionDisabled: boolean;
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

  const periodLabel = dayPeriod === 'am' ? content.amLabel : content.pmLabel;
  const selectedSlotSummary =
    selectedYmd.trim().length > 0
      ? formatConsultationSelectedSlotSummary(
          selectedYmd,
          dayPeriod,
          locale,
          timeZone,
          periodLabel,
        )
      : '';

  return (
    <div data-consultation-date-picker='true' className='flex flex-col gap-6'>
      <p className='text-base font-semibold leading-6 es-text-heading'>
        {content.pickDateTimeIntro}
      </p>

      <div>
        <p
          className='text-lg font-semibold leading-6 es-text-heading'
          aria-live='polite'
        >
          {monthHeading}
        </p>

        <p className='sr-only' id={gridLabelId}>
          {content.datePickerLegend}
        </p>
        <div className='mt-6 overflow-x-auto' aria-labelledby={gridLabelId}>
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
              <tr key={`w-${rowIndex}`}>
                {row.days.map((cell) => {
                  const isSelected = cell.ymd === selectedYmd;
                  const isDayDisabled = cell.isDisabled || interactionDisabled;
                  let ariaDayLabel: string;
                  if (interactionDisabled && !cell.isDisabled) {
                    ariaDayLabel = formatSlotDayAriaLabel(
                      content.datePickerLoadingDayTemplate,
                      cell.dayOfMonth,
                    );
                  } else if (isDayDisabled) {
                    ariaDayLabel = formatSlotDayAriaLabel(
                      content.datePickerUnavailableDayTemplate,
                      cell.dayOfMonth,
                    );
                  } else {
                    ariaDayLabel = formatSlotDayAriaLabel(
                      content.datePickerDayTemplate,
                      cell.dayOfMonth,
                    );
                  }
                  return (
                    <td key={cell.ymd} className='p-1'>
                      <button
                        type='button'
                        disabled={isDayDisabled}
                        aria-pressed={isSelected}
                        aria-label={ariaDayLabel}
                        className={mergeClassNames(
                          'flex h-10 w-full min-w-[2.25rem] items-center justify-center rounded-lg text-base font-semibold transition-colors',
                          isDayDisabled
                            ? 'cursor-not-allowed opacity-30'
                            : 'es-text-heading hover:es-bg-surface-muted',
                          isSelected && !isDayDisabled
                            ? 'border-2 es-border-warm-2 es-bg-brand-orange-soft'
                            : 'border border-transparent',
                        )}
                        onClick={() => {
                          if (!isDayDisabled) {
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

      <div className='flex flex-col items-center gap-1'>
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
              interactionDisabled ||
              !selectedYmd ||
              isConsultationPeriodBlocked(selectedYmd, 'am', unavailableByYmd)
            }
            className={mergeClassNames(
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              interactionDisabled ||
                !selectedYmd ||
                isConsultationPeriodBlocked(selectedYmd, 'am', unavailableByYmd)
                ? 'cursor-not-allowed opacity-40'
                : dayPeriod === 'am'
                  ? 'es-bg-brand-orange-soft es-text-body opacity-80 shadow-sm'
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
              interactionDisabled ||
              !selectedYmd ||
              isConsultationPeriodBlocked(selectedYmd, 'pm', unavailableByYmd)
            }
            className={mergeClassNames(
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              interactionDisabled ||
                !selectedYmd ||
                isConsultationPeriodBlocked(selectedYmd, 'pm', unavailableByYmd)
                ? 'cursor-not-allowed opacity-40'
                : dayPeriod === 'pm'
                  ? 'es-bg-brand-orange-soft es-text-body opacity-80 shadow-sm'
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

      {selectedSlotSummary ? (
        <div
          className='mt-3 flex items-start gap-4'
          data-testid='consultation-modal-selected-slot'
        >
          <span className='es-icon-circle-lg shrink-0'>
            <span
              data-testid='consultation-modal-selected-slot-calendar-icon'
              className='es-mask-calendar-danger h-[36.8px] w-[36.8px] shrink-0'
              aria-hidden='true'
            />
          </span>
          <div className='min-w-0 flex-1'>
            <p className='text-[17px] font-semibold leading-6 es-text-heading'>
              {selectedSlotSummary}
            </p>
            <p className='mt-4 text-base font-semibold leading-6 es-text-heading'>
              {content.dateConfirmationNote}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ConsultationBookingModal({
  locale = 'en',
  paymentModalContent,
  bookingPayload,
  pickerContent,
  calendarAvailability,
  calendarBlockersStatus = 'ready',
  calendarBlockersLoadingMessage = '',
  calendarBlockersErrorMessage = '',
  selectionInfo,
  levelFeaturesEnterAnimationNonce = 0,
  analyticsSectionId = 'consultations-booking',
  metaPixelContentName = PIXEL_CONTENT_NAME.consultation_booking,
  captchaWidgetAction = 'consultation_reservation_submit',
  thankYouRecapLabels,
  onClose,
  onSubmitReservation,
  onUpgradeToDeepDive,
}: ConsultationBookingModalProps) {
  const topicsFieldConfig = bookingPayload.topicsFieldConfig;
  const {
    modalPanelRef,
    closeButtonRef,
    dialogTitleId,
    dialogDescriptionId,
  } = useBookingModalScaffold(onClose);

  const timeZone = useMemo(() => PUBLIC_SITE_IANA_TIMEZONE, []);

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

  const featuresListAnimationClass =
    selectionInfo?.levelId === 'deep-dive' && levelFeaturesEnterAnimationNonce > 0
      ? 'es-consultations-booking-level-description-enter'
      : undefined;

  const selectedYmd = pickerSelection?.ymd ?? defaultSelection?.ymd ?? '';
  const dayPeriod = pickerSelection?.period ?? defaultSelection?.period ?? 'am';

  function handleSelectYmd(ymd: string) {
    setPickerSelection((prev) => {
      const preferredPeriod =
        prev?.period ?? defaultSelection?.period ?? 'am';
      if (!isConsultationPeriodBlocked(ymd, preferredPeriod, unavailableByYmd)) {
        return { ymd, period: preferredPeriod };
      }
      const period = firstSelectableConsultationPeriod(ymd, unavailableByYmd);
      return period ? { ymd, period } : prev;
    });
  }

  function handleSelectPeriod(period: ConsultationDayPeriod) {
    if (!selectedYmd || isConsultationPeriodBlocked(selectedYmd, period, unavailableByYmd)) {
      return;
    }
    setPickerSelection({ ymd: selectedYmd, period });
  }

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
    <div className='flex flex-col gap-4'>
      {calendarBlockersStatus === 'error' && calendarBlockersErrorMessage.trim() ? (
        <p
          className='rounded-lg border border-black/15 px-4 py-3 text-sm font-medium leading-snug es-text-body'
          role='status'
          aria-live='polite'
          data-testid='consultation-calendar-blockers-status'
        >
          {calendarBlockersErrorMessage}
        </p>
      ) : null}
      {calendarBlockersStatus === 'loading' ? (
        <SectionSpinnerStatus
          label={
            calendarBlockersLoadingMessage.trim()
              ? calendarBlockersLoadingMessage
              : '\u00a0'
          }
          testId='consultation-calendar-blockers-loading'
        />
      ) : (
        <ConsultationDatePickerGrid
          locale={locale}
          content={pickerContent}
          timeZone={timeZone}
          unavailableByYmd={unavailableByYmd}
          selectedYmd={selectedYmd}
          dayPeriod={dayPeriod}
          interactionDisabled={false}
          onSelectYmd={handleSelectYmd}
          onSelectPeriod={handleSelectPeriod}
        />
      )}
    </div>
  );

  const subtitleSlot = selectionInfo ? (
    <div className='es-consultation-booking-modal-subtitle-slot mt-3'>
      <p className='text-xl font-semibold leading-7 es-text-heading'>
        {selectionInfo.focusLabelFormatted}
      </p>
      <div
        key={`${selectionInfo.levelId}-${levelFeaturesEnterAnimationNonce}`}
        className={featuresListAnimationClass}
      >
        <ul className={CONSULTATION_MODAL_LEVEL_FEATURES_LIST_CLASSNAME}>
          {selectionInfo.levelFeatures.map((feature, index) => (
            <li
              key={`modal-feature-${selectionInfo.levelId}-${index}`}
              className={CONSULTATION_MODAL_LEVEL_FEATURE_LINE_CLASSNAME}
            >
              {feature}
            </li>
          ))}
        </ul>
      </div>
      {selectionInfo.levelId === 'essentials' && onUpgradeToDeepDive ? (
        <div className='mt-5'>
          <ButtonPrimitive
            type='button'
            variant='primary'
            className='max-w-[360px] es-btn--outline'
            onClick={onUpgradeToDeepDive}
          >
            {selectionInfo.upgradeToDeepDiveLabel}
          </ButtonPrimitive>
        </div>
      ) : null}
    </div>
  ) : undefined;

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
        subtitleSlot={subtitleSlot}
      />
      <BookingReservationForm
        // Modal open implies user intent; pre-mount Turnstile to keep Stripe PaymentIntent prefetch.
        initiallyInteracted
        locale={locale}
        content={paymentModalContent}
        eventTitle={bookingPayload.title}
        serviceKey={bookingPayload.serviceKey}
        serviceTypeLabelKey='consultation'
        bookingSystem={CONSULTATION_BOOKING_SYSTEM}
        eventSubtitle={bookingPayload.subtitle}
        sessionSlots={rebasedParts.map((part) => {
          return {
            dateStartTime: part.startDateTime,
            dateEndTime: part.endDateTime,
          };
        })}
        selectedServiceTierLabel=''
        selectedCohortDateLabel={bookingPayload.selectedDateLabel}
        selectedDateStartTime={selectedDateStartTime}
        originalPriceAmount={bookingPayload.originalAmount}
        venueName={bookingPayload.locationName}
        venueAddress={bookingPayload.locationAddress}
        venueDirectionHref={bookingPayload.directionHref ?? ''}
        dateEndTime={rebasedParts[0]?.endDateTime ?? ''}
        topicsFieldConfig={topicsFieldConfig}
        topicsPrefill={bookingPayload.topicsPrefill}
        consultationWritingFocusLabel={selectionInfo?.focusLabel ?? ''}
        consultationLevelLabel={selectionInfo?.levelLabel ?? ''}
        descriptionId={dialogDescriptionId}
        analyticsSectionId={analyticsSectionId}
        metaPixelContentName={metaPixelContentName}
        captchaWidgetAction={captchaWidgetAction}
        thankYouRecapLabels={thankYouRecapLabels}
        onSubmitReservation={onSubmitReservation}
      />
    </BookingFlowModalShell>
  );
}
