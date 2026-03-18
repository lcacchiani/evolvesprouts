'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import { SectionShell } from '@/components/sections/shared/section-shell';
import enContent from '@/content/en.json';
import type {
  BookingModalContent,
  CommonAccessibilityContent,
  Locale,
  MyBestAuntieBookingContent,
  MyBestAuntieModalContent,
} from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

const MyBestAuntieBookingModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieBookingModal,
    ),
  { ssr: false },
);

const MyBestAuntieThankYouModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieThankYouModal,
    ),
  { ssr: false },
);

interface MyBestAuntieBookingProps {
  locale: Locale;
  content: MyBestAuntieBookingContent;
  modalContent: MyBestAuntieModalContent;
  bookingModalContent: BookingModalContent;
  commonAccessibility?: CommonAccessibilityContent;
}

function DateArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`h-7 w-7 es-text-icon ${rotationClass}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M8 4L16 12L8 20'
        stroke='currentColor'
        strokeWidth='2.4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function formatCohortPreviewLabel(value: string): string {
  const firstDateSegment = value.split(/\s+-\s+/)[0]?.trim() ?? value.trim();

  return firstDateSegment.replace(/\s+(am|pm)$/i, '$1');
}

const COHORT_VALUE_PATTERN = /^(\d{2})-(\d{2})$/;

function parseCohortValue(value: string): { monthIndex: number; year: number } | null {
  const trimmedValue = value.trim();
  const match = COHORT_VALUE_PATTERN.exec(trimmedValue);
  if (!match) {
    return null;
  }

  const monthNumber = Number(match[1]);
  const yearSuffix = Number(match[2]);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  if (!Number.isInteger(yearSuffix)) {
    return null;
  }

  return {
    monthIndex: monthNumber - 1,
    year: 2000 + yearSuffix,
  };
}

function formatCohortValue(value: string): string {
  const parsed = parseCohortValue(value);
  if (!parsed) {
    return value;
  }

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(parsed.year, parsed.monthIndex, 1)));
  return `${monthLabel}, ${parsed.year}`;
}

function getCohortSortValue(value: string): number {
  const parsed = parseCohortValue(value);
  if (!parsed) {
    return Number.POSITIVE_INFINITY;
  }

  return parsed.year * 100 + (parsed.monthIndex + 1);
}

function formatNextCohortLabel(
  scheduleLabel: string,
  ageGroupLabel: string,
  template: string,
): string {
  if (!ageGroupLabel) {
    return scheduleLabel;
  }

  return formatContentTemplate(template, {
    scheduleLabel,
    ageGroupLabel,
  });
}

const BOOKING_SELECTOR_CARD_CLASSNAME = 'es-my-best-auntie-booking-selector-card';
const BOOKING_SYSTEM_QUERY_PARAM = 'booking_system';
const MY_BEST_AUNTIE_BOOKING_SYSTEM = 'my-best-auntie-booking';

type BookingCohort = MyBestAuntieBookingContent['cohorts'][number];

interface BookingDateOption {
  id: string;
  label: string;
  availabilityLabel: string;
  isFullyBooked: boolean;
  cohort: BookingCohort;
}

function formatSpacesLeftLabel(count: number, template: string): string {
  return formatContentTemplate(template, {
    count: String(count),
  });
}

function shouldAutoOpenMyBestAuntieBookingModal(searchValue: string): boolean {
  const queryParams = new URLSearchParams(searchValue);
  return queryParams.get(BOOKING_SYSTEM_QUERY_PARAM) === MY_BEST_AUNTIE_BOOKING_SYSTEM;
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

function getPrimarySessionSortValue(cohort: BookingCohort): number {
  const startDateTime = cohort.dates[0]?.start_datetime?.trim() ?? '';
  if (!startDateTime) {
    return Number.POSITIVE_INFINITY;
  }
  const parsedDate = Date.parse(startDateTime);
  if (Number.isNaN(parsedDate)) {
    return Number.POSITIVE_INFINITY;
  }
  return parsedDate;
}

function sortCohortsByPrimarySession(
  leftCohort: BookingCohort,
  rightCohort: BookingCohort,
): number {
  const dateDifference =
    getPrimarySessionSortValue(leftCohort) -
    getPrimarySessionSortValue(rightCohort);

  if (dateDifference !== 0) {
    return dateDifference;
  }

  const cohortDifference = getCohortSortValue(leftCohort.cohort) -
    getCohortSortValue(rightCohort.cohort);
  if (cohortDifference !== 0) {
    return cohortDifference;
  }

  return leftCohort.id.localeCompare(rightCohort.id);
}

function findPreferredCohortId(
  cohorts: BookingCohort[],
  ageGroupId: string,
): string {
  const ageGroupCohorts = cohorts.filter(
    (cohort) => cohort.age_group === ageGroupId,
  );
  const available = ageGroupCohorts.find((cohort) => !cohort.is_fully_booked);
  return available?.id ?? ageGroupCohorts[0]?.id ?? '';
}

function getPrimarySessionDateTimeLabel(cohort: BookingCohort | null): string {
  const startDateTime = cohort?.dates[0]?.start_datetime ?? '';
  return formatPartDateTimeLabel(startDateTime);
}

function formatCohortPrice(
  price: number,
  currency: string,
  locale: Locale,
): string {
  const numberFormatLocale = locale === 'en' ? 'en-HK' : locale;
  const normalizedCurrency = currency.trim();

  if (/^[A-Z]{3}$/.test(normalizedCurrency)) {
    try {
      return new Intl.NumberFormat(numberFormatLocale, {
        style: 'currency',
        currency: normalizedCurrency,
        maximumFractionDigits: 0,
      }).format(price);
    } catch {
      // fall through to symbol formatting
    }
  }

  const formattedAmount = new Intl.NumberFormat(numberFormatLocale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(price);

  if (!normalizedCurrency) {
    return formattedAmount;
  }

  return `${normalizedCurrency}${formattedAmount}`;
}

export function MyBestAuntieBooking({
  locale,
  content,
  modalContent,
  bookingModalContent,
  commonAccessibility = enContent.common.accessibility,
}: MyBestAuntieBookingProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isThankYouModalOpen, setIsThankYouModalOpen] = useState(false);
  const [reservationSummary, setReservationSummary] =
    useState<ReservationSummary | null>(null);

  const ageOptions = content.ageOptions ?? [];
  const sortedCohorts = [...(content.cohorts ?? [])].sort(
    sortCohortsByPrimarySession,
  );
  const initialAgeId = ageOptions[0]?.id ?? '';
  const initialDateId =
    findPreferredCohortId(sortedCohorts, initialAgeId);

  const [selectedAgeId, setSelectedAgeId] = useState(initialAgeId);
  const cohortsForSelectedAge = sortedCohorts.filter((cohort) => {
    return cohort.age_group === selectedAgeId;
  });
  const dateOptions: BookingDateOption[] = cohortsForSelectedAge.map((cohort) => ({
    id: cohort.id,
    label: formatCohortValue(cohort.cohort),
    availabilityLabel: formatSpacesLeftLabel(
      cohort.spaces_left,
      content.spacesLeftLabelTemplate,
    ),
    isFullyBooked: cohort.is_fully_booked,
    cohort,
  }));
  const [selectedDateId, setSelectedDateId] = useState(initialDateId);
  const dateCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hasHandledAutoOpenModalRef = useRef(false);
  const {
    carouselRef: dateCarouselRef,
    hasNavigation: hasDateNavigation,
    canScrollPrevious: canScrollDateLeft,
    canScrollNext: canScrollDateRight,
    scrollByDirection: scrollDateCarouselByDirection,
    scrollItemIntoView,
  } = useHorizontalCarousel<HTMLDivElement>({
    itemCount: dateOptions.length,
    minItemsForNavigation: 3,
    loop: false,
  });

  const selectedAgeOption =
    ageOptions.find((option) => option.id === selectedAgeId) ?? ageOptions[0];
  const selectedDateOption =
    dateOptions.find((option) => option.id === selectedDateId) ?? dateOptions[0];
  const selectedCohort = selectedDateOption?.cohort ?? dateOptions[0]?.cohort ?? null;
  const nextCohortForSelectedAge = cohortsForSelectedAge[0] ?? null;
  const nextCohortDate = getPrimarySessionDateTimeLabel(nextCohortForSelectedAge);
  const nextCohortLabel = formatNextCohortLabel(
    content.scheduleLabel,
    selectedAgeOption?.label ?? '',
    content.nextCohortLabelTemplate,
  );
  const nextCohortPreview = nextCohortDate
    ? formatCohortPreviewLabel(nextCohortDate)
    : content.noCohortsLabel;
  const nextCohortPriceLabel = nextCohortForSelectedAge
    ? formatCohortPrice(
        nextCohortForSelectedAge.price,
        nextCohortForSelectedAge.currency,
        locale,
      )
    : '';

  useEffect(() => {
    const selectedDateCard = dateCardRefs.current[selectedDateId];
    scrollItemIntoView(selectedDateCard);
  }, [scrollItemIntoView, selectedDateId]);

  useEffect(() => {
    if (hasHandledAutoOpenModalRef.current) {
      return;
    }
    hasHandledAutoOpenModalRef.current = true;

    if (typeof window === 'undefined') {
      return;
    }
    if (!shouldAutoOpenMyBestAuntieBookingModal(window.location.search)) {
      return;
    }
    if (!selectedCohort || selectedCohort.is_fully_booked) {
      return;
    }

    const openModalTimerId = window.setTimeout(() => {
      trackAnalyticsEvent('booking_modal_open', {
        sectionId: 'my-best-auntie-booking',
        ctaLocation: 'query_param',
        params: {
          age_group: selectedCohort.age_group,
          cohort_label: selectedCohort.cohort,
          cohort_date: selectedCohort.dates[0]?.start_datetime?.split('T')[0] ?? '',
        },
      });
      trackMetaPixelEvent('InitiateCheckout', { content_name: 'my_best_auntie' });
      setIsPaymentModalOpen(true);
    }, 0);

    return () => {
      window.clearTimeout(openModalTimerId);
    };
  }, [selectedCohort]);

  useEffect(() => {
    if (!isThankYouModalOpen || !reservationSummary) {
      return;
    }

    trackAnalyticsEvent('booking_thank_you_view', {
      sectionId: 'my-best-auntie-booking',
      ctaLocation: 'thank_you_modal',
      params: {
        payment_method: reservationSummary.paymentMethod,
        total_amount: reservationSummary.totalAmount,
        age_group: reservationSummary.ageGroup,
        cohort_date: reservationSummary.dateStartTime?.split('T')[0] ?? '',
      },
    });
  }, [isThankYouModalOpen, reservationSummary]);

  function handleDateCarouselNavigation(direction: 'prev' | 'next') {
    scrollDateCarouselByDirection(direction);
  }

  return (
    <>
      <SectionShell
        id='my-best-auntie-booking'
        ariaLabel={content.title}
        dataFigmaNode='my-best-auntie-booking'
        className='es-my-best-auntie-booking-section'
      >
        <SectionContainer
          className={buildSectionSplitLayoutClassName(
            'es-section-split-layout--my-best-auntie-booking w-full min-w-0 items-center',
          )}
        >
          <div className='space-y-5 max-w-[620px] lg:pr-8'>
            <SectionHeader
              title={content.title}
              titleAs='h2'
              align='left'
              className='max-w-[620px]'
              titleClassName='es-my-best-auntie-booking-heading'
              description={content.description}
              descriptionClassName='mt-5 max-w-[58ch] es-type-body es-my-best-auntie-booking-body'
            />

            <div className='pt-3'>
              <div
                data-testid='my-best-auntie-next-cohort-card'
                className='w-full max-w-[410px] rounded-inner border es-border-warm-2 es-bg-surface-soft px-5 py-4'
              >
                <p className='text-base font-semibold es-text-brand'>
                  {nextCohortLabel}
                </p>
                <p className='es-type-subtitle-lg mt-1 es-text-heading'>
                  {nextCohortPreview}
                </p>
                {nextCohortPriceLabel ? (
                  <p className='mt-1 text-base font-semibold es-text-heading'>
                    {nextCohortPriceLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <aside className='mx-auto w-full min-w-0 max-w-[573px] lg:ml-auto lg:mr-0'>
            <h2 className='text-[1.6rem] font-semibold es-text-heading'>
              {content.eyebrow}
            </h2>

            <div className='mt-6'>
              <h3 className='text-sm font-semibold es-text-neutral-strong'>
                {content.ageSelectorLabel}
              </h3>
              <div className='mt-3 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
                {ageOptions.map((option) => {
                  const isSelected = option.id === selectedAgeId;

                  return (
                    <ButtonPrimitive
                      key={option.id}
                      variant='selection'
                      state={isSelected ? 'active' : 'inactive'}
                      aria-pressed={isSelected}
                      onClick={() => {
                        trackAnalyticsEvent('booking_age_selected', {
                          sectionId: 'my-best-auntie-booking',
                          ctaLocation: 'selector',
                          params: {
                            age_group: option.label,
                          },
                        });
                        setSelectedAgeId(option.id);
                        const nextDateId = findPreferredCohortId(
                          sortedCohorts,
                          option.id,
                        );
                        setSelectedDateId(nextDateId);
                      }}
                      className={`${BOOKING_SELECTOR_CARD_CLASSNAME} w-[140px] snap-center text-left sm:w-[168px]`}
                    >
                      <div className='flex items-center justify-start gap-4 sm:gap-10'>
                        <Image
                          src={option.iconSrc}
                          alt=''
                          width={48}
                          height={48}
                          className='h-12 w-12'
                          aria-hidden='true'
                        />
                        <span className='text-lg font-semibold es-text-heading'>
                          {option.label}
                        </span>
                      </div>
                    </ButtonPrimitive>
                  );
                })}
              </div>
            </div>

            <div className='mt-7'>
              <h3 className='text-sm font-semibold es-text-neutral-strong'>
                {content.dateSelectorLabel}
              </h3>
              <div className='relative mt-3 w-full min-w-0 overflow-visible'>
                <CarouselTrack
                  carouselRef={dateCarouselRef}
                  testId='my-best-auntie-booking-date-carousel'
                  ariaLabel={content.dateSelectorLabel}
                  ariaRoleDescription={commonAccessibility.carouselRoleDescription}
                  className='flex min-w-0 gap-3 pb-2 pr-1'
                >
                  {dateOptions.map((option) => {
                    const isSelected = option.id === selectedDateId;
                    const isFullyBooked = option.isFullyBooked;

                    return (
                      <ButtonPrimitive
                        key={option.id}
                        buttonRef={(element) => {
                          dateCardRefs.current[option.id] = element;
                        }}
                        variant='selection'
                        state={isFullyBooked ? 'inactive' : isSelected ? 'active' : 'inactive'}
                        aria-pressed={isFullyBooked ? undefined : isSelected}
                        aria-disabled={isFullyBooked || undefined}
                        onClick={
                          isFullyBooked
                            ? undefined
                            : () => {
                                trackAnalyticsEvent('booking_date_selected', {
                                  sectionId: 'my-best-auntie-booking',
                                  ctaLocation: 'selector',
                                  params: {
                                    age_group: selectedAgeOption?.label ?? '',
                                    cohort_label: option.label,
                                    cohort_date: option.cohort.dates[0]?.start_datetime?.split('T')[0]
                                      ?? '',
                                    is_fully_booked: option.isFullyBooked,
                                  },
                                });
                                setSelectedDateId(option.id);
                              }
                        }
                        className={`${BOOKING_SELECTOR_CARD_CLASSNAME} relative w-[140px] snap-center text-center sm:w-[168px] ${isFullyBooked ? 'pointer-events-none' : ''}`}
                      >
                        {isFullyBooked && (
                          <span className='es-cohort-sold-out-stamp' aria-hidden='true'>
                            <span className='es-cohort-sold-out-stamp-text'>
                              {content.soldOutStampLabel}
                            </span>
                          </span>
                        )}
                        <div className={`flex w-full flex-col items-center gap-2 ${isFullyBooked ? 'opacity-40' : ''}`}>
                          <div className='flex items-center justify-center gap-1.5'>
                            <span
                              className={`h-6 w-6 shrink-0 es-mask-calendar-current ${isSelected && !isFullyBooked ? 'es-btn-selection-icon-active' : 'es-btn-selection-icon-inactive'}`}
                              aria-hidden='true'
                            />
                            <p className='text-base font-semibold es-text-heading whitespace-nowrap'>
                              {option.label}
                            </p>
                          </div>
                          <p className='text-center text-sm es-text-danger-accent'>
                            {option.availabilityLabel}
                          </p>
                        </div>
                      </ButtonPrimitive>
                    );
                  })}
                </CarouselTrack>

                {hasDateNavigation && canScrollDateLeft && (
                  <ButtonPrimitive
                    variant='control'
                    onClick={() => {
                      handleDateCarouselNavigation('prev');
                    }}
                    aria-label={content.scrollDatesLeftAriaLabel}
                    className='absolute left-0 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:flex'
                  >
                    <DateArrowIcon direction='left' />
                  </ButtonPrimitive>
                )}

                {hasDateNavigation && canScrollDateRight && (
                  <ButtonPrimitive
                    variant='control'
                    onClick={() => {
                      handleDateCarouselNavigation('next');
                    }}
                    aria-label={content.scrollDatesRightAriaLabel}
                    className='absolute right-0 top-1/2 z-20 hidden translate-x-1/2 -translate-y-1/2 md:flex'
                  >
                    <DateArrowIcon direction='right' />
                  </ButtonPrimitive>
                )}
              </div>
            </div>

            <ButtonPrimitive
              variant='primary'
              onClick={() => {
                if (!selectedCohort || selectedCohort.is_fully_booked) {
                  return;
                }
                trackAnalyticsEvent('booking_confirm_pay_click', {
                  sectionId: 'my-best-auntie-booking',
                  ctaLocation: 'booking_section',
                  params: {
                    age_group: selectedAgeOption?.label ?? '',
                    cohort_label: selectedDateOption?.label ?? '',
                    cohort_date: selectedCohort.dates[0]?.start_datetime?.split('T')[0] ?? '',
                    total_amount: selectedCohort.price,
                  },
                });
                trackAnalyticsEvent('booking_modal_open', {
                  sectionId: 'my-best-auntie-booking',
                  ctaLocation: 'booking_section',
                  params: {
                    age_group: selectedAgeOption?.label ?? '',
                    cohort_label: selectedDateOption?.label ?? '',
                    cohort_date: selectedCohort.dates[0]?.start_datetime?.split('T')[0] ?? '',
                  },
                });
                trackMetaPixelEvent('InitiateCheckout', { content_name: 'my_best_auntie' });
                setIsPaymentModalOpen(true);
              }}
              disabled={!selectedCohort || selectedCohort.is_fully_booked}
              className='mt-7'
            >
              {content.confirmAndPayLabel}
            </ButtonPrimitive>
          </aside>
        </SectionContainer>
      </SectionShell>

      {isPaymentModalOpen && (
        <MyBestAuntieBookingModal
          locale={locale}
          modalContent={modalContent}
          paymentModalContent={bookingModalContent.paymentModal}
          selectedCohort={selectedCohort}
          selectedCohortDateLabel={selectedDateOption?.label ?? ''}
          selectedAgeGroupLabel={selectedAgeOption?.label ?? ''}
          onClose={() => {
            setIsPaymentModalOpen(false);
          }}
          onSubmitReservation={(summary) => {
            setReservationSummary(summary);
            setIsPaymentModalOpen(false);
            setIsThankYouModalOpen(true);
          }}
        />
      )}

      {isThankYouModalOpen && (
        <MyBestAuntieThankYouModal
          locale={locale}
          content={bookingModalContent.thankYouModal}
          summary={reservationSummary}
          homeHref={`/${locale}`}
          onClose={() => {
            setIsThankYouModalOpen(false);
          }}
        />
      )}
    </>
  );
}
