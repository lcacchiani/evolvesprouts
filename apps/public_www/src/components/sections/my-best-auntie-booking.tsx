'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import type { ReservationSummary } from '@/components/sections/my-best-auntie-booking-modal';
import { SectionShell } from '@/components/sections/shared/section-shell';
import type { Locale, MyBestAuntieBookingContent } from '@/content';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';

const MyBestAuntieBookingModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieBookingModal,
    ),
  { ssr: false },
);

const MyBestAuntieThankYouModal = dynamic(
  () =>
    import('@/components/sections/my-best-auntie-booking-modal').then(
      (module) => module.MyBestAuntieThankYouModal,
    ),
  { ssr: false },
);

interface MyBestAuntieBookingProps {
  locale: Locale;
  content: MyBestAuntieBookingContent;
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

function formatNextCohortLabel(
  scheduleLabel: string,
  ageGroupLabel: string,
  locale: Locale,
): string {
  if (!ageGroupLabel) {
    return scheduleLabel;
  }

  if (locale === 'zh-CN') {
    return `${scheduleLabel}（${ageGroupLabel} 岁组）`;
  }

  if (locale === 'zh-HK') {
    return `${scheduleLabel}（${ageGroupLabel} 歲組）`;
  }

  return `${scheduleLabel} for ${ageGroupLabel} age group`;
}

const BOOKING_SELECTOR_CARD_CLASSNAME = 'es-my-best-auntie-booking-selector-card';

type BookingCohort = MyBestAuntieBookingContent['cohorts'][number];

interface BookingDateOption {
  id: string;
  label: string;
  availabilityLabel: string;
  cohort: BookingCohort;
}

function getPrimarySessionSortValue(cohort: BookingCohort): number {
  const isoDate = cohort.sessions[0]?.isoDate?.trim() ?? '';
  if (!isoDate) {
    return Number.POSITIVE_INFINITY;
  }
  const parsedDate = Date.parse(`${isoDate}T00:00:00Z`);
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

  return leftCohort.dateLabel.localeCompare(rightCohort.dateLabel);
}

function getPrimarySessionDateTimeLabel(cohort: BookingCohort | null): string {
  return cohort?.sessions[0]?.dateTimeLabel ?? '';
}

function formatCohortPrice(
  price: number,
  priceCurrency: string,
  locale: Locale,
): string {
  const numberFormatLocale = locale === 'en' ? 'en-HK' : locale;

  try {
    return new Intl.NumberFormat(numberFormatLocale, {
      style: 'currency',
      currency: priceCurrency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${priceCurrency} ${price}`;
  }
}

export function MyBestAuntieBooking({
  locale,
  content,
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
    sortedCohorts.find((cohort) => cohort.ageGroupId === initialAgeId)?.id ?? '';

  const [selectedAgeId, setSelectedAgeId] = useState(initialAgeId);
  const cohortsForSelectedAge = sortedCohorts.filter((cohort) => {
    return cohort.ageGroupId === selectedAgeId;
  });
  const dateOptions: BookingDateOption[] = cohortsForSelectedAge.map((cohort) => ({
    id: cohort.id,
    label: cohort.dateLabel,
    availabilityLabel: cohort.spacesLeftText,
    cohort,
  }));
  const [selectedDateId, setSelectedDateId] = useState(initialDateId);
  const dateCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
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
  });

  const selectedAgeOption =
    ageOptions.find((option) => option.id === selectedAgeId) ?? ageOptions[0];
  const selectedDateOption =
    dateOptions.find((option) => option.id === selectedDateId) ?? dateOptions[0];
  const selectedCohort = selectedDateOption?.cohort ?? dateOptions[0]?.cohort ?? null;
  const nextCohortDate = getPrimarySessionDateTimeLabel(selectedCohort);
  const nextCohortLabel = formatNextCohortLabel(
    content.scheduleLabel,
    selectedAgeOption?.label ?? '',
    locale,
  );
  const nextCohortPreview = nextCohortDate
    ? formatCohortPreviewLabel(nextCohortDate)
    : content.noCohortsLabel;
  const nextCohortPriceLabel = selectedCohort
    ? formatCohortPrice(
        selectedCohort.price,
        selectedCohort.priceCurrency,
        locale,
      )
    : '';

  useEffect(() => {
    const selectedDateCard = dateCardRefs.current[selectedDateId];
    scrollItemIntoView(selectedDateCard);
  }, [scrollItemIntoView, selectedDateId]);

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
              titleAs='h1'
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
                <p className='es-type-subtitle-lg mt-1 es-text-heading-alt'>
                  {nextCohortPreview}
                </p>
                {nextCohortPriceLabel ? (
                  <p className='mt-1 text-base font-semibold es-text-heading-alt'>
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
              <div className='mt-3 flex min-w-0 gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
                {ageOptions.map((option) => {
                  const isSelected = option.id === selectedAgeId;

                  return (
                    <ButtonPrimitive
                      key={option.id}
                      variant='selection'
                      state={isSelected ? 'active' : 'inactive'}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedAgeId(option.id);
                        const nextDateId =
                          sortedCohorts.find((cohort) => cohort.ageGroupId === option.id)
                            ?.id ?? '';
                        setSelectedDateId(nextDateId);
                      }}
                      className={`${BOOKING_SELECTOR_CARD_CLASSNAME} text-left`}
                    >
                      <div className='flex items-center justify-start gap-10'>
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
                <div
                  role='region'
                  aria-roledescription='carousel'
                  aria-label={content.dateSelectorLabel}
                  className='w-full min-w-0 overflow-hidden'
                >
                  <div
                    ref={dateCarouselRef}
                    data-testid='my-best-auntie-booking-date-carousel'
                    className='flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                  >
                    {dateOptions.map((option) => {
                      const isSelected = option.id === selectedDateId;

                      return (
                        <ButtonPrimitive
                          key={option.id}
                          buttonRef={(element) => {
                            dateCardRefs.current[option.id] = element;
                          }}
                          variant='selection'
                          state={isSelected ? 'active' : 'inactive'}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedDateId(option.id);
                          }}
                          className={`${BOOKING_SELECTOR_CARD_CLASSNAME} snap-start text-center`}
                        >
                          <div className='flex w-full flex-col items-center gap-2'>
                            <div className='flex items-center justify-center gap-1.5'>
                              <span
                                className={`h-6 w-6 shrink-0 es-mask-calendar-current ${isSelected ? 'es-btn-selection-icon-active' : 'es-btn-selection-icon-inactive'}`}
                                aria-hidden='true'
                              />
                              <p className='text-base font-semibold es-text-heading'>
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
                  </div>
                </div>

                {hasDateNavigation && canScrollDateLeft && (
                  <ButtonPrimitive
                    variant='control'
                    onClick={() => {
                      handleDateCarouselNavigation('prev');
                    }}
                    aria-label='Scroll dates left'
                    className='absolute left-0 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2'
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
                    aria-label='Scroll dates right'
                    className='absolute right-0 top-1/2 z-20 translate-x-1/2 -translate-y-1/2'
                  >
                    <DateArrowIcon direction='right' />
                  </ButtonPrimitive>
                )}
              </div>
            </div>

            <ButtonPrimitive
              variant='primary'
              onClick={() => {
                if (!selectedCohort) {
                  return;
                }
                setIsPaymentModalOpen(true);
              }}
              disabled={!selectedCohort}
              className='mt-7'
            >
              {content.confirmAndPayLabel}
            </ButtonPrimitive>
          </aside>
        </SectionContainer>
      </SectionShell>

      {isPaymentModalOpen && (
        <MyBestAuntieBookingModal
          content={content.paymentModal}
          selectedCohort={selectedCohort}
          selectedAgeGroupLabel={selectedAgeOption?.label ?? ''}
          learnMoreLabel={content.learnMoreLabel}
          learnMoreHref={content.learnMoreHref}
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
          content={content.thankYouModal}
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
