/* eslint-disable @next/next/no-img-element -- static SVG icons from /public/images */

'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type {
  BookingModalContent,
  CommonAccessibilityContent,
  ConsultationsBookingContent,
  ConsultationsBookingReservationContent,
  Locale,
} from '@/content';
import enContent from '@/content/en.json';
import { formatContentTemplate } from '@/content/content-field-utils';
import type { CalendarAvailabilityPayload } from '@/lib/calendar-availability';
import {
  buildConsultationsBookingModalPayload,
  type ConsultationsBookingModalTierId,
} from '@/lib/consultations-booking-modal-payload';
import { mergeClassNames } from '@/lib/class-name-utils';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';
import { useMatchMedia } from '@/lib/hooks/use-match-media';
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

const LEVEL_CARD_ICON_BAND_CLASSNAME =
  'flex min-h-[84px] flex-none flex-col justify-center';

const LEVEL_FEATURES_LIST_CLASSNAME = 'mt-3 list-none space-y-2 ps-0 text-left';
const LEVEL_FEATURE_LINE_CLASSNAME = 'block ps-0 text-left es-type-body es-text-dim';

const MD_UP_MEDIA_QUERY = '(min-width: 768px)';

const MOBILE_CAROUSEL_SLIDE_LI_CLASSNAME =
  'flex h-full min-h-0 w-[77.28vw] max-w-[331px] shrink-0 flex-col snap-center sm:w-[62.56vw]';

const GRID_CARD_LI_CLASSNAME = 'flex min-h-0 flex-col';

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
  commonAccessibility?: CommonAccessibilityContent;
}

export function ConsultationsBooking({
  locale,
  content,
  bookingModalContent,
  calendarAvailability,
  thankYouWhatsappHref,
  thankYouWhatsappCtaLabel,
  commonAccessibility = enContent.common.accessibility,
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

  const isMdUp = useMatchMedia(MD_UP_MEDIA_QUERY);

  const { carouselRef: focusCarouselRef, scrollByDirection: scrollFocusCarouselByDirection } =
    useHorizontalCarousel<HTMLDivElement>({
      itemCount: content.focusAreas.length,
      enabled: !isMdUp,
      snapToItem: true,
    });

  const { carouselRef: levelCarouselRef, scrollByDirection: scrollLevelCarouselByDirection } =
    useHorizontalCarousel<HTMLDivElement>({
      itemCount: content.levels.length,
      enabled: !isMdUp,
      snapToItem: true,
    });

  const handleFocusCarouselKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isMdUp) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollFocusCarouselByDirection('prev');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollFocusCarouselByDirection('next');
      }
    },
    [isMdUp, scrollFocusCarouselByDirection],
  );

  const handleLevelCarouselKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isMdUp) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollLevelCarouselByDirection('prev');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollLevelCarouselByDirection('next');
      }
    },
    [isMdUp, scrollLevelCarouselByDirection],
  );

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
            <div className='relative mt-6'>
              {!isMdUp ? (
                <div className='relative'>
                  <CarouselTrack
                    carouselRef={focusCarouselRef}
                    testId='consultations-booking-focus-carousel'
                    ariaLabel={formatContentTemplate(
                      commonAccessibility.carouselLabelTemplate,
                      { title: content.step1Title },
                    )}
                    ariaRoleDescription={commonAccessibility.carouselRoleDescription}
                    className='pb-2 outline-none es-focus-ring'
                    tabIndex={0}
                    onKeyDown={handleFocusCarouselKeyDown}
                  >
                    <ul className='flex min-w-0 list-none items-stretch gap-6 ps-0'>
                      {content.focusAreas.map((area) => {
                        const isSelected = area.id === selectedFocusId;
                        return (
                          <li
                            key={area.id}
                            className={MOBILE_CAROUSEL_SLIDE_LI_CLASSNAME}
                          >
                            <ButtonPrimitive
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
                                'flex h-full min-h-0 flex-1 flex-col',
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
                          </li>
                        );
                      })}
                    </ul>
                  </CarouselTrack>
                </div>
              ) : (
                <div
                  role='group'
                  aria-label={content.step1Title}
                  data-testid='consultations-booking-focus-grid'
                >
                  <ul className='grid list-none grid-cols-3 gap-6 ps-0'>
                    {content.focusAreas.map((area) => {
                      const isSelected = area.id === selectedFocusId;
                      return (
                        <li key={area.id} className={GRID_CARD_LI_CLASSNAME}>
                          <ButtonPrimitive
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
                              'flex h-full min-h-0 flex-col',
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
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className='mt-12'>
            <h3 className='text-xl font-semibold es-type-body md:text-center'>
              {content.step2Title}
            </h3>
            <div className='relative mt-6'>
              {!isMdUp ? (
                <div className='relative'>
                  <CarouselTrack
                    carouselRef={levelCarouselRef}
                    testId='consultations-booking-level-carousel'
                    ariaLabel={formatContentTemplate(
                      commonAccessibility.carouselLabelTemplate,
                      { title: content.step2Title },
                    )}
                    ariaRoleDescription={commonAccessibility.carouselRoleDescription}
                    className='pb-2 outline-none es-focus-ring'
                    tabIndex={0}
                    onKeyDown={handleLevelCarouselKeyDown}
                  >
                    <ul className='flex min-w-0 list-none items-stretch gap-6 ps-0'>
                      {content.levels.map((level) => {
                        const isSelected = level.id === selectedLevelId;
                        return (
                          <li
                            key={level.id}
                            className={MOBILE_CAROUSEL_SLIDE_LI_CLASSNAME}
                          >
                            <ButtonPrimitive
                              type='button'
                              variant='selection'
                              state={isSelected ? 'active' : 'inactive'}
                              aria-pressed={isSelected}
                              aria-label={level.title}
                              onClick={() => {
                                setSelectedLevelId(level.id);
                              }}
                              className={mergeClassNames(
                                LEVEL_CARD_CLASSNAME,
                                'h-full min-h-0 flex-1',
                              )}
                            >
                              <div className={LEVEL_CARD_ICON_BAND_CLASSNAME}>
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
                              </div>
                              <h4 className='mt-5 text-lg font-bold es-text-heading'>
                                {level.title}
                              </h4>
                              {'includesLabel' in level && level.includesLabel && (
                                <p className='mt-3 text-left text-sm font-medium es-text-dim'>
                                  {level.includesLabel}
                                </p>
                              )}
                              <ul className={LEVEL_FEATURES_LIST_CLASSNAME}>
                                {level.features.map((feature, index) => (
                                  <li
                                    key={`${level.id}-feature-${index}`}
                                    className={LEVEL_FEATURE_LINE_CLASSNAME}
                                  >
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                              <p className='mt-4 text-left text-sm italic es-type-body es-text-dim'>
                                {level.bestFor}
                              </p>
                            </ButtonPrimitive>
                          </li>
                        );
                      })}
                    </ul>
                  </CarouselTrack>
                </div>
              ) : (
                <div
                  role='group'
                  aria-label={content.step2Title}
                  data-testid='consultations-booking-level-grid'
                >
                  <ul className='grid list-none grid-cols-2 gap-6 ps-0'>
                    {content.levels.map((level) => {
                      const isSelected = level.id === selectedLevelId;
                      return (
                        <li key={level.id} className={GRID_CARD_LI_CLASSNAME}>
                          <ButtonPrimitive
                            type='button'
                            variant='selection'
                            state={isSelected ? 'active' : 'inactive'}
                            aria-pressed={isSelected}
                            aria-label={level.title}
                            onClick={() => {
                              setSelectedLevelId(level.id);
                            }}
                            className={mergeClassNames(
                              LEVEL_CARD_CLASSNAME,
                              'h-full min-h-0',
                            )}
                          >
                            <div className={LEVEL_CARD_ICON_BAND_CLASSNAME}>
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
                            </div>
                            <h4 className='mt-5 text-lg font-bold es-text-heading'>
                              {level.title}
                            </h4>
                            {'includesLabel' in level && level.includesLabel && (
                              <p className='mt-3 text-left text-sm font-medium es-text-dim'>
                                {level.includesLabel}
                              </p>
                            )}
                            <ul className={LEVEL_FEATURES_LIST_CLASSNAME}>
                              {level.features.map((feature, index) => (
                                <li
                                  key={`${level.id}-feature-${index}`}
                                  className={LEVEL_FEATURE_LINE_CLASSNAME}
                                >
                                  {feature}
                                </li>
                              ))}
                            </ul>
                            <p className='mt-4 text-left text-sm italic es-type-body es-text-dim'>
                              {level.bestFor}
                            </p>
                          </ButtonPrimitive>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
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
