/* eslint-disable @next/next/no-img-element -- static SVG icons from /public/images */

'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type {
  BookingModalContent,
  ConsultationsBookingContent,
  ConsultationsBookingReservationContent,
  Locale,
} from '@/content';
import type { CalendarAvailabilityPayload } from '@/lib/calendar-availability';
import {
  buildConsultationsBookingModalPayload,
  type ConsultationsBookingModalTierId,
} from '@/lib/consultations-booking-modal-payload';
import { mergeClassNames } from '@/lib/class-name-utils';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import type { ConsultationBookingPickerContent } from '@/components/sections/consultations/consultation-booking-modal';

const ConsultationBookingModal = dynamic(
  () =>
    import('@/components/sections/consultations/consultation-booking-modal').then(
      (module) => module.ConsultationBookingModal,
    ),
  { ssr: false },
);

const BookingThankYouModal = dynamic(
  () =>
    import('@/components/sections/booking-modal/thank-you-modal').then(
      (module) => module.BookingThankYouModal,
    ),
  { ssr: false },
);

const FOCUS_LEVEL_CARD_CLASSNAME =
  'w-full rounded-3xl border es-border-soft es-bg-surface-neutral px-6 py-7 text-left sm:px-8 sm:py-8';

const LEVEL_CARD_CLASSNAME = mergeClassNames(
  FOCUS_LEVEL_CARD_CLASSNAME,
  'flex flex-col items-stretch justify-start',
);

const CONSULTATIONS_BOOKING_ICON_CIRCLE_CLASSNAME =
  'inline-flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full border es-border-soft es-bg-surface-muted shadow-[0_8px_24px_rgba(0,0,0,0.2)]';

function mapLevelIdToBookingTier(levelId: string): ConsultationsBookingModalTierId {
  return levelId === 'deep-dive' ? 'deepDive' : 'essentials';
}

function buildConsultationPickerContent(
  paymentModal: BookingModalContent['paymentModal'],
): ConsultationBookingPickerContent {
  const p = paymentModal.consultationPicker;
  return {
    amLabel: p.amLabel,
    pmLabel: p.pmLabel,
    monthJoiner: p.monthJoiner,
    weekdayShortLabels: [
      p.weekdayShortMon,
      p.weekdayShortTue,
      p.weekdayShortWed,
      p.weekdayShortThu,
      p.weekdayShortFri,
    ],
    datePickerLegend: p.datePickerLegend,
    datePickerDayTemplate: p.datePickerDayTemplate,
    datePickerUnavailableDayTemplate: p.datePickerUnavailableDayTemplate,
  };
}

interface ConsultationsBookingProps {
  locale: Locale;
  content: ConsultationsBookingContent;
  bookingModalContent: BookingModalContent;
  calendarAvailability: CalendarAvailabilityPayload;
  thankYouWhatsappHref?: string;
  thankYouWhatsappCtaLabel?: string;
}

export function ConsultationsBooking({
  locale,
  content,
  bookingModalContent,
  calendarAvailability,
  thankYouWhatsappHref,
  thankYouWhatsappCtaLabel,
}: ConsultationsBookingProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [thankYouSummary, setThankYouSummary] = useState<ReservationSummary | null>(
    null,
  );
  const [isThankYouOpen, setIsThankYouOpen] = useState(false);

  const [selectedFocusId, setSelectedFocusId] = useState(
    () => content.focusAreas[0]?.id ?? '',
  );
  const [selectedLevelId, setSelectedLevelId] = useState(
    () => content.levels[0]?.id ?? '',
  );

  const reservationForModal: ConsultationsBookingReservationContent = useMemo(() => {
    return {
      ...content.reservation,
      bookingTier: mapLevelIdToBookingTier(selectedLevelId),
    };
  }, [content.reservation, selectedLevelId]);

  const selectionLabels = useMemo(() => {
    const focus = content.focusAreas.find((a) => a.id === selectedFocusId);
    const level = content.levels.find((l) => l.id === selectedLevelId);
    return {
      focusLabel: focus?.title ?? '',
      levelLabel: level?.title ?? '',
    };
  }, [content.focusAreas, content.levels, selectedFocusId, selectedLevelId]);

  const bookingPayload = isBookingModalOpen
    ? buildConsultationsBookingModalPayload(
        reservationForModal,
        locale,
        selectionLabels,
      )
    : null;

  const consultationPickerContent = useMemo(() => {
    return buildConsultationPickerContent(bookingModalContent.paymentModal);
  }, [bookingModalContent.paymentModal]);

  return (
    <>
      <SectionShell
        id='consultations-booking'
        ariaLabel={content.title}
        dataFigmaNode='consultations-booking'
        className={mergeClassNames(
          'es-section-bg-overlay',
          'es-my-best-auntie-booking-section',
        )}
      >
        <SectionContainer>
          <SectionHeader
            eyebrow={content.eyebrow}
            title={content.title}
            titleClassName='es-my-best-auntie-booking-heading'
          />

          <div className='mt-12'>
            <h3 className='text-xl font-semibold es-type-body md:text-center'>
              {content.step1Title}
            </h3>
            <div className='mt-6 grid grid-cols-1 gap-6 md:grid-cols-3'>
              {content.focusAreas.map((area) => {
                const isSelected = area.id === selectedFocusId;
                return (
                  <ButtonPrimitive
                    key={area.id}
                    type='button'
                    variant='selection'
                    state={isSelected ? 'active' : 'inactive'}
                    aria-pressed={isSelected}
                    aria-label={area.title}
                    onClick={() => {
                      setSelectedFocusId(area.id);
                    }}
                    className={mergeClassNames(
                      FOCUS_LEVEL_CARD_CLASSNAME,
                      'flex flex-col',
                    )}
                  >
                    <div className='flex justify-center'>
                      <span
                        aria-hidden='true'
                        className={CONSULTATIONS_BOOKING_ICON_CIRCLE_CLASSNAME}
                      >
                        <img
                          src={area.iconSrc}
                          alt=''
                          width={44}
                          height={44}
                          className={mergeClassNames(
                            'h-11 w-11 shrink-0 object-contain transition-[filter] duration-200',
                            isSelected
                              ? 'es-consultations-booking-selection-icon-active'
                              : 'es-consultations-booking-selection-icon-inactive',
                          )}
                        />
                      </span>
                    </div>
                    <h4 className='mt-5 text-lg font-bold es-text-heading'>
                      {area.title}
                    </h4>
                    <p className='mt-2 es-type-body es-text-dim'>
                      {area.description}
                    </p>
                  </ButtonPrimitive>
                );
              })}
            </div>
          </div>

          <div className='mt-12'>
            <h3 className='text-xl font-semibold es-type-body md:text-center'>
              {content.step2Title}
            </h3>
            <div className='mt-6 grid grid-cols-1 gap-6 md:grid-cols-2'>
              {content.levels.map((level) => {
                const isSelected = level.id === selectedLevelId;
                return (
                  <ButtonPrimitive
                    key={level.id}
                    type='button'
                    variant='selection'
                    state={isSelected ? 'active' : 'inactive'}
                    aria-pressed={isSelected}
                    aria-label={level.title}
                    onClick={() => {
                      setSelectedLevelId(level.id);
                    }}
                    className={LEVEL_CARD_CLASSNAME}
                  >
                    <div className='flex flex-col'>
                      <div className='flex justify-center'>
                        <span
                          aria-hidden='true'
                          className={CONSULTATIONS_BOOKING_ICON_CIRCLE_CLASSNAME}
                        >
                          <img
                            src={level.iconSrc}
                            alt=''
                            width={44}
                            height={44}
                            className={mergeClassNames(
                              'h-11 w-11 shrink-0 object-contain transition-[filter] duration-200',
                              isSelected
                                ? 'es-consultations-booking-selection-icon-active'
                                : 'es-consultations-booking-selection-icon-inactive',
                            )}
                          />
                        </span>
                      </div>
                      <h4 className='mt-5 text-lg font-bold es-text-heading'>
                        {level.title}
                      </h4>
                    </div>
                    {'includesLabel' in level && level.includesLabel && (
                      <p className='mt-3 text-sm font-medium es-text-dim'>
                        {level.includesLabel}
                      </p>
                    )}
                    <ul className='mt-3 list-none space-y-2 ps-0'>
                      {level.features.map((feature, index) => (
                        <li
                          key={`${level.id}-feature-${index}`}
                          className='flex items-start gap-2 ps-0 es-type-body es-text-dim'
                        >
                          <span
                            className='mt-1 inline-block h-2 w-2 shrink-0 rounded-full es-bg-accent'
                            aria-hidden='true'
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <p className='mt-4 text-sm italic es-type-body es-text-dim'>
                      {level.bestFor}
                    </p>
                  </ButtonPrimitive>
                );
              })}
            </div>
          </div>

          <div
            className={buildSectionSplitLayoutClassName(
              'mt-12 flex flex-col sm:flex-row md:justify-center',
            )}
          >
            <ButtonPrimitive
              type='button'
              variant='primary'
              className={mergeClassNames(
                'max-w-full',
                'sm:max-w-[450px]',
              )}
              onClick={() => {
                setIsBookingModalOpen(true);
              }}
            >
              {content.reservation.ctaLabel}
            </ButtonPrimitive>
          </div>
        </SectionContainer>
      </SectionShell>

      {bookingPayload ? (
        <ConsultationBookingModal
          locale={locale}
          paymentModalContent={bookingModalContent.paymentModal}
          bookingPayload={bookingPayload}
          calendarAvailability={calendarAvailability}
          pickerContent={consultationPickerContent}
          analyticsSectionId='consultations-booking'
          metaPixelContentName={PIXEL_CONTENT_NAME.consultation_booking}
          captchaWidgetAction='consultation_reservation_submit'
          onClose={() => {
            setIsBookingModalOpen(false);
          }}
          onSubmitReservation={(summary) => {
            setIsBookingModalOpen(false);
            setThankYouSummary(summary);
            setIsThankYouOpen(true);
          }}
        />
      ) : null}

      {isThankYouOpen && (
        <BookingThankYouModal
          locale={locale}
          content={bookingModalContent.thankYouModal}
          summary={thankYouSummary}
          analyticsSectionId='consultations-booking'
          whatsappHref={thankYouWhatsappHref}
          whatsappCtaLabel={thankYouWhatsappCtaLabel}
          onClose={() => {
            setIsThankYouOpen(false);
          }}
        />
      )}
    </>
  );
}
