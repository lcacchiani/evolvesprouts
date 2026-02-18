'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

import { ButtonPrimitive } from '@/components/button-primitive';
import { SectionContainer } from '@/components/section-container';
import type { ReservationSummary } from '@/components/sections/my-best-auntie-booking-modal';
import { createMaskIconStyle } from '@/components/sections/booking-modal/helpers';
import { SectionShell } from '@/components/section-shell';
import type { Locale, MyBestAuntieBookingContent } from '@/content';
import {
  bodyTextStyle,
  headingTextStyle,
  SURFACE_WHITE,
  TEXT_ICON_COLOR,
} from '@/lib/design-tokens';
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

const SECTION_BACKGROUND = SURFACE_WHITE;
const CALENDAR_ICON_MASK_PATH = '/images/calendar.svg';
const DATE_CONTROL_ICON = TEXT_ICON_COLOR;

const headingStyle: CSSProperties = headingTextStyle({
  lineHeight: 1.15,
});

const bodyStyle: CSSProperties = bodyTextStyle({
  lineHeight: 1.55,
});

const dateSelectorCalendarIconMaskStyle = createMaskIconStyle(
  CALENDAR_ICON_MASK_PATH,
  'currentColor',
);

function DateArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`h-7 w-7 ${rotationClass}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M8 4L16 12L8 20'
        stroke={DATE_CONTROL_ICON}
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

export function MyBestAuntieBooking({
  locale,
  content,
}: MyBestAuntieBookingProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isThankYouModalOpen, setIsThankYouModalOpen] = useState(false);
  const [reservationSummary, setReservationSummary] =
    useState<ReservationSummary | null>(null);

  const ageOptions = content.ageOptions ?? [];
  const dateOptions =
    content.dateOptions.length > 0
      ? content.dateOptions
      : content.paymentModal.monthOptions.map((option) => ({
          id: option.id,
          label: option.label,
          availabilityLabel: content.availabilityLabel,
        }));

  const [selectedAgeId, setSelectedAgeId] = useState(ageOptions[0]?.id ?? '');
  const [selectedDateId, setSelectedDateId] = useState(dateOptions[0]?.id ?? '');
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

  const modalMonthId =
    selectedDateOption?.id ?? content.paymentModal.monthOptions[0]?.id ?? '';
  const firstCoursePart = content.paymentModal.parts[0];
  const firstMonthId =
    content.paymentModal.monthOptions[0]?.id ?? dateOptions[0]?.id ?? '';
  const firstMonthEntry = firstCoursePart
    ? Object.entries(firstCoursePart.dateByMonth).find(
        ([monthId]) => monthId === firstMonthId,
      )
    : undefined;
  const firstCohortDate = firstMonthEntry?.[1];
  const nextCohortDate =
    firstCohortDate ??
    dateOptions[0]?.label ??
    content.scheduleDate;
  const nextCohortPreview = formatCohortPreviewLabel(nextCohortDate);

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
        dataFigmaNode='book_spot_Sec'
        style={{ backgroundColor: SECTION_BACKGROUND }}
      >
        <SectionContainer>
          <div className='grid w-full min-w-0 items-center gap-8 lg:grid-cols-2 lg:gap-6'>
            <section className='space-y-5 max-w-[620px] lg:pr-8'>
              <h1
                className='text-[clamp(2rem,5.6vw,3.3rem)]'
                style={headingStyle}
              >
                {content.title}
              </h1>
              <p
                className='max-w-[58ch] text-[clamp(1rem,2vw,1.2rem)]'
                style={bodyStyle}
              >
                {content.description}
              </p>

              <div className='pt-3'>
                <div
                  data-testid='my-best-auntie-next-cohort-card'
                  className='w-full max-w-[410px] rounded-[14px] border es-border-warm-2 es-bg-surface-soft px-5 py-4'
                >
                  <p className='text-base font-semibold es-text-brand'>
                    {content.scheduleLabel}
                  </p>
                  <p className='mt-1 text-[clamp(1.3rem,3vw,1.7rem)] font-bold es-text-heading-alt'>
                    {nextCohortPreview}
                  </p>
                </div>
              </div>
            </section>

            <aside className='mx-auto w-full min-w-0 max-w-[764px] lg:ml-auto lg:mr-0'>
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
                        }}
                        className='min-h-[76px] w-[175px] shrink-0 rounded-[8px] px-4 py-2 text-left'
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
                <div className='mt-3 min-w-0'>
                  <div className='relative w-full min-w-0 overflow-visible'>
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
                              className='w-[168px] shrink-0 snap-start rounded-[14px] px-4 py-3 text-left'
                            >
                              <div className='flex items-center justify-start gap-1.5'>
                                <span
                                  className={`h-6 w-6 shrink-0 ${isSelected ? 'es-btn-selection-icon-active' : 'es-btn-selection-icon-inactive'}`}
                                  style={dateSelectorCalendarIconMaskStyle}
                                  aria-hidden='true'
                                />
                                <p className='text-base font-semibold es-text-heading'>
                                  {option.label}
                                </p>
                              </div>
                              <p className='mt-2 text-center text-sm es-text-danger-accent'>
                                {option.availabilityLabel}
                              </p>
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
              </div>

              <ButtonPrimitive
                variant='primary'
                onClick={() => {
                  setIsPaymentModalOpen(true);
                }}
                className='mt-7'
              >
                {content.confirmAndPayLabel}
              </ButtonPrimitive>
            </aside>
          </div>
        </SectionContainer>
      </SectionShell>

      {isPaymentModalOpen && (
        <MyBestAuntieBookingModal
          content={content.paymentModal}
          initialMonthId={modalMonthId}
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
