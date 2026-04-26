'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { ExternalLinkInlineContent } from '@/components/shared/external-link-icon';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import { EventsLoadingState } from '@/components/sections/shared/events-shared';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { buildThankYouRecapLabels } from '@/components/sections/booking-modal/thank-you-recap-labels';
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
import type { MyBestAuntieEventCohort } from '@/lib/events-data';
import {
  formatCohortValue,
  formatPartDateTimeLabel,
  parseCohortValue,
} from '@/lib/format';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';
import { trackAnalyticsEvent, trackEcommerceEvent } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import { readReferralCodeFromSearch } from '@/lib/referral-link';
import { useMyBestAuntieCohorts } from '@/components/sections/my-best-auntie/use-my-best-auntie-cohorts';

const MyBestAuntieBookingModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieBookingModal,
    ),
  { ssr: false },
);

const MyBestAuntieThankYouModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie/my-best-auntie-thank-you-modal').then(
      (module) => module.MyBestAuntieThankYouModal,
    ),
  { ssr: false },
);

interface MyBestAuntieBookingProps {
  locale: Locale;
  content: MyBestAuntieBookingContent;
  initialCohorts: MyBestAuntieEventCohort[];
  modalContent: MyBestAuntieModalContent;
  bookingModalContent: BookingModalContent;
  commonAccessibility?: CommonAccessibilityContent;
  thankYouWhatsappHref?: string;
  thankYouWhatsappCtaLabel?: string;
  privateProgrammeWhatsappHref?: string;
}

function DateArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <span
      aria-hidden
      className={`es-ui-icon-mask es-ui-icon-mask--chevron-right inline-block h-7 w-7 shrink-0 es-text-icon ${rotationClass}`}
    />
  );
}

function formatCohortPreviewLabel(value: string): string {
  const firstDateSegment = value.split(/\s+-\s+/)[0]?.trim() ?? value.trim();

  return firstDateSegment.replace(/\s+(am|pm)$/i, '$1');
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
const MY_BEST_AUNTIE_SERVICE_KEY = 'my-best-auntie';

interface BookingDateOption {
  id: string;
  label: string;
  availabilityLabel: string;
  isFullyBooked: boolean;
  cohort: MyBestAuntieEventCohort;
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

function getPrimarySessionSortValue(cohort: MyBestAuntieEventCohort): number {
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
  leftCohort: MyBestAuntieEventCohort,
  rightCohort: MyBestAuntieEventCohort,
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

  return leftCohort.slug.localeCompare(rightCohort.slug);
}

function findPreferredCohortId(
  cohorts: MyBestAuntieEventCohort[],
  ageGroupId: string,
): string {
  const ageGroupCohorts = cohorts.filter(
    (cohort) => cohort.service_tier === ageGroupId,
  );
  const available = ageGroupCohorts.find((cohort) => !cohort.is_fully_booked);
  return available?.slug ?? ageGroupCohorts[0]?.slug ?? '';
}

function getPrimarySessionDateTimeLabel(
  cohort: MyBestAuntieEventCohort | null,
  locale: Locale,
): string {
  const startDateTime = cohort?.dates[0]?.start_datetime ?? '';
  return formatPartDateTimeLabel(startDateTime, locale);
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
  initialCohorts,
  modalContent,
  bookingModalContent,
  commonAccessibility = enContent.common.accessibility,
  thankYouWhatsappHref,
  thankYouWhatsappCtaLabel,
  privateProgrammeWhatsappHref,
}: MyBestAuntieBookingProps) {
  const {
    cohorts: cohortsFromHook,
    isLoading: isCohortsLoading,
    hasRequestError: hasCohortsRequestError,
  } = useMyBestAuntieCohorts({
    initialCohorts,
    serviceKey: MY_BEST_AUNTIE_SERVICE_KEY,
    serviceType: 'training_course',
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isThankYouModalOpen, setIsThankYouModalOpen] = useState(false);
  const [reservationSummary, setReservationSummary] =
    useState<ReservationSummary | null>(null);
  const [prefilledDiscountCode, setPrefilledDiscountCode] = useState('');

  const ageOptions = content.ageOptions ?? [];
  const sortedCohorts = [...cohortsFromHook].sort(sortCohortsByPrimarySession);
  const initialAgeId = ageOptions[0]?.id ?? '';

  const [selectedAgeId, setSelectedAgeId] = useState(initialAgeId);
  const cohortsForSelectedAge = sortedCohorts.filter((cohort) => {
    return cohort.service_tier === selectedAgeId;
  });
  const dateOptions: BookingDateOption[] = cohortsForSelectedAge.map((cohort) => ({
    id: cohort.slug,
    label: formatCohortValue(cohort.cohort, locale),
    availabilityLabel: formatSpacesLeftLabel(
      cohort.spaces_left,
      content.spacesLeftLabelTemplate,
    ),
    isFullyBooked: cohort.is_fully_booked,
    cohort,
  }));
  /** User-picked cohort slug for the current age tier; cleared on age change. */
  const [pendingDateSelectionSlug, setPendingDateSelectionSlug] = useState<string | null>(
    null,
  );
  const preferredDateId = findPreferredCohortId(sortedCohorts, selectedAgeId);
  const selectedDateId =
    pendingDateSelectionSlug
    && sortedCohorts.some(
      (cohort) =>
        cohort.service_tier === selectedAgeId && cohort.slug === pendingDateSelectionSlug,
    )
      ? pendingDateSelectionSlug
      : preferredDateId;
  const dateCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hasHandledReferralPrefillRef = useRef(false);
  const hasOpenedBookingModalFromQueryRef = useRef(false);
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
  const nextCohortDate = getPrimarySessionDateTimeLabel(nextCohortForSelectedAge, locale);
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
    if (typeof window === 'undefined') {
      return;
    }

    if (!hasHandledReferralPrefillRef.current) {
      hasHandledReferralPrefillRef.current = true;
      const referral = readReferralCodeFromSearch(window.location.search);
      if (referral) {
        queueMicrotask(() => {
          setPrefilledDiscountCode(referral);
        });
      }
    }

    if (!shouldAutoOpenMyBestAuntieBookingModal(window.location.search)) {
      return;
    }
    if (hasOpenedBookingModalFromQueryRef.current) {
      return;
    }
    if (!selectedCohort || selectedCohort.is_fully_booked) {
      return;
    }

    hasOpenedBookingModalFromQueryRef.current = true;

    const openModalTimerId = window.setTimeout(() => {
      trackAnalyticsEvent('booking_modal_open', {
        sectionId: 'my-best-auntie-booking',
        ctaLocation: 'query_param',
        params: {
          age_group: selectedCohort.service_tier,
          cohort_label: selectedCohort.cohort,
          cohort_date: selectedCohort.dates[0]?.start_datetime?.split('T')[0] ?? '',
        },
      });
      trackMetaPixelEvent('InitiateCheckout', { content_name: PIXEL_CONTENT_NAME.my_best_auntie });
      trackEcommerceEvent('begin_checkout', {
        value: selectedCohort.price,
        items: [{
          item_id: `mba-${selectedCohort.service_tier}`,
          item_name: 'My Best Auntie',
          item_category: selectedCohort.service_tier,
          price: selectedCohort.price,
          quantity: 1,
        }],
      });
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

            <div
              className='mt-4'
              aria-live={isCohortsLoading || hasCohortsRequestError ? 'polite' : undefined}
            >
              {isCohortsLoading ? (
                <EventsLoadingState
                  label={content.cohortsLoadingLabel}
                  testId='my-best-auntie-cohorts-loading'
                />
              ) : null}
              {hasCohortsRequestError && !isCohortsLoading ? (
                <p className='text-sm text-black/60'>{content.cohortsErrorLabel}</p>
              ) : null}
            </div>

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
                        setPendingDateSelectionSlug(null);
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
                                setPendingDateSelectionSlug(option.id);
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

            <div className='mt-7 flex flex-wrap items-center gap-3'>
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
                  trackMetaPixelEvent('InitiateCheckout', { content_name: PIXEL_CONTENT_NAME.my_best_auntie });
                  trackMetaPixelEvent('AddPaymentInfo', {
                    content_name: PIXEL_CONTENT_NAME.my_best_auntie,
                    value: selectedCohort.price,
                    currency: 'HKD',
                  });
                  trackEcommerceEvent('begin_checkout', {
                    value: selectedCohort.price,
                    items: [{
                      item_id: `mba-${selectedCohort.service_tier}`,
                      item_name: 'My Best Auntie',
                      item_category: selectedCohort.service_tier,
                      price: selectedCohort.price,
                      quantity: 1,
                    }],
                  });
                  setIsPaymentModalOpen(true);
                }}
                disabled={
                  dateOptions.length === 0
                  || !selectedCohort
                  || selectedCohort.is_fully_booked
                }
              >
                {content.confirmAndPayLabel}
              </ButtonPrimitive>
              {privateProgrammeWhatsappHref ? (
                <ButtonPrimitive
                  variant='primary'
                  className='es-btn--outline'
                  href={privateProgrammeWhatsappHref}
                >
                  {({ isExternalHttp }) => (
                    <ExternalLinkInlineContent isExternalHttp={isExternalHttp}>
                      {content.privateProgrammeCtaLabel}
                    </ExternalLinkInlineContent>
                  )}
                </ButtonPrimitive>
              ) : null}
            </div>
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
          prefilledDiscountCode={prefilledDiscountCode}
          referralAppliedNote={content.referralAppliedNote}
          referralAppliedAnnouncement={commonAccessibility.referralAppliedAnnouncement}
          thankYouRecapLabels={buildThankYouRecapLabels(bookingModalContent.thankYouModal)}
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
          whatsappHref={thankYouWhatsappHref}
          whatsappCtaLabel={thankYouWhatsappCtaLabel}
          onClose={() => {
            setIsThankYouModalOpen(false);
          }}
        />
      )}
    </>
  );
}
