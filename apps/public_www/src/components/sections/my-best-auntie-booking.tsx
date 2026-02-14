'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

import {
  MyBestAuntieBookingModal,
  MyBestAuntieThankYouModal,
  type ReservationSummary,
} from '@/components/sections/my-best-auntie-booking-modal';
import { SectionShell } from '@/components/section-shell';
import type { Locale, MyBestAuntieBookingContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';

interface MyBestAuntieBookingProps {
  locale: Locale;
  content: MyBestAuntieBookingContent;
}

const SECTION_BACKGROUND = '#FFFFFF';

const headingStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: 1.15,
};

const bodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: 1.55,
};

const inactiveSelectorCardStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #EED5C1',
};

const activeSelectorCardStyle: CSSProperties = {
  backgroundColor: '#FFD4B5',
  border: '2px solid #E76C3D',
  boxShadow: '0 0 14px rgba(231, 108, 61, 0.5)',
};

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
  const [canScrollDatePrev, setCanScrollDatePrev] = useState(false);
  const [canScrollDateNext, setCanScrollDateNext] = useState(false);
  const dateCarouselRef = useRef<HTMLDivElement | null>(null);
  const dateCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectedAgeOption =
    ageOptions.find((option) => option.id === selectedAgeId) ?? ageOptions[0];
  const selectedDateOption =
    dateOptions.find((option) => option.id === selectedDateId) ?? dateOptions[0];

  const modalMonthId =
    selectedDateOption?.id ?? content.paymentModal.monthOptions[0]?.id ?? '';

  function syncDateCarouselControls() {
    const carouselElement = dateCarouselRef.current;

    if (!carouselElement) {
      setCanScrollDatePrev(false);
      setCanScrollDateNext(false);
      return;
    }

    const canScrollPrev = carouselElement.scrollLeft > 4;
    const canScrollNext =
      carouselElement.scrollLeft + carouselElement.clientWidth <
      carouselElement.scrollWidth - 4;

    setCanScrollDatePrev(canScrollPrev);
    setCanScrollDateNext(canScrollNext);
  }

  useEffect(() => {
    const carouselElement = dateCarouselRef.current;
    if (!carouselElement) {
      return;
    }

    syncDateCarouselControls();

    function handleDateCarouselScroll() {
      syncDateCarouselControls();
    }

    carouselElement.addEventListener('scroll', handleDateCarouselScroll, {
      passive: true,
    });
    window.addEventListener('resize', syncDateCarouselControls);

    return () => {
      carouselElement.removeEventListener('scroll', handleDateCarouselScroll);
      window.removeEventListener('resize', syncDateCarouselControls);
    };
  }, [dateOptions.length]);

  useEffect(() => {
    const selectedDateCard = dateCardRefs.current[selectedDateId];
    if (!selectedDateCard) {
      return;
    }

    selectedDateCard.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [selectedDateId]);

  function handleDateCarouselNavigation(direction: 'prev' | 'next') {
    const carouselElement = dateCarouselRef.current;
    if (!carouselElement) {
      return;
    }

    const step = Math.max(180, Math.round(carouselElement.clientWidth * 0.8));
    const leftOffset = direction === 'prev' ? -step : step;

    carouselElement.scrollBy({
      left: leftOffset,
      behavior: 'smooth',
    });
  }

  return (
    <>
      <SectionShell
        id='my-best-auntie-booking'
        ariaLabel={content.title}
        dataFigmaNode='book_spot_Sec'
        style={{ backgroundColor: SECTION_BACKGROUND }}
      >
        <div className='mx-auto w-full max-w-[1465px]'>
          <div className='grid min-w-0 gap-8 lg:grid-cols-[1fr_470px] lg:items-start'>
            <section className='space-y-5 lg:pr-8'>
              <p className='text-sm font-semibold uppercase tracking-[0.14em] text-[#C84A16]'>
                {content.eyebrow}
              </p>
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

              <div className='space-y-1 pt-3'>
                <p className='text-sm font-semibold text-[#5A5A5A]'>
                  {content.scheduleLabel}
                </p>
                <p className='mt-2 text-[clamp(1.2rem,2.6vw,1.8rem)] font-semibold text-[#333333]'>
                  {selectedDateOption?.label ?? content.scheduleDate}
                </p>
                <p className='mt-1 text-[#4A4A4A]'>{content.scheduleTime}</p>
              </div>
            </section>

            <aside className='min-w-0 rounded-[22px] border border-[#EED5C1] bg-[#FFF8F2] p-5 sm:p-6'>
              <h2 className='text-[1.6rem] font-semibold text-[#333333]'>
                {content.eyebrow}
              </h2>

              <div className='mt-6'>
                <h3 className='text-sm font-semibold text-[#5A5A5A]'>
                  {content.ageSelectorLabel}
                </h3>
                <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3'>
                  {ageOptions.map((option) => {
                    const isSelected = option.id === selectedAgeId;

                    return (
                      <button
                        key={option.id}
                        type='button'
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedAgeId(option.id);
                        }}
                        className='es-focus-ring rounded-[14px] px-3 py-3'
                        style={
                          isSelected
                            ? activeSelectorCardStyle
                            : inactiveSelectorCardStyle
                        }
                      >
                        <div className='flex items-center justify-between gap-2'>
                          <Image
                            src={option.iconSrc}
                            alt=''
                            width={30}
                            height={30}
                            className='h-[30px] w-[30px]'
                            aria-hidden='true'
                          />
                          <span className='text-lg font-semibold text-[#333333]'>
                            {option.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className='mt-7'>
                <h3 className='text-sm font-semibold text-[#5A5A5A]'>
                  {content.dateSelectorLabel}
                </h3>
                <div className='mt-3 min-w-0'>
                  <div
                    role='region'
                    aria-roledescription='carousel'
                    aria-label={content.dateSelectorLabel}
                    className='w-full min-w-0 overflow-hidden'
                  >
                    <div
                      ref={dateCarouselRef}
                      className='flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                    >
                      {dateOptions.map((option) => {
                        const isSelected = option.id === selectedDateId;

                        return (
                          <button
                            key={option.id}
                            ref={(element) => {
                              dateCardRefs.current[option.id] = element;
                            }}
                            type='button'
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedDateId(option.id);
                            }}
                            className='es-focus-ring w-[168px] shrink-0 snap-start rounded-[14px] px-4 py-3 text-left'
                            style={
                              isSelected
                                ? activeSelectorCardStyle
                                : inactiveSelectorCardStyle
                            }
                          >
                            <div className='flex items-center justify-between gap-3'>
                              <Image
                                src={
                                  isSelected
                                    ? '/images/calendar-orange.png'
                                    : '/images/calendar-dark.png'
                                }
                                alt=''
                                width={24}
                                height={24}
                                className='h-6 w-6'
                                aria-hidden='true'
                              />
                              <p className='text-base font-semibold text-[#333333]'>
                                {option.label}
                              </p>
                            </div>
                            <p className='mt-2 text-center text-sm text-[#C71B1B]'>
                              {option.availabilityLabel}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {dateOptions.length > 1 && (
                    <div className='mt-2 flex items-center justify-end gap-2'>
                      <button
                        type='button'
                        onClick={() => {
                          handleDateCarouselNavigation('prev');
                        }}
                        aria-label='Scroll dates left'
                        disabled={!canScrollDatePrev}
                        className='es-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EED5C1] bg-white text-[#333333] disabled:cursor-not-allowed disabled:opacity-45'
                      >
                        <span aria-hidden='true'>&larr;</span>
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          handleDateCarouselNavigation('next');
                        }}
                        aria-label='Scroll dates right'
                        disabled={!canScrollDateNext}
                        className='es-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EED5C1] bg-white text-[#333333] disabled:cursor-not-allowed disabled:opacity-45'
                      >
                        <span aria-hidden='true'>&rarr;</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type='button'
                onClick={() => {
                  setIsPaymentModalOpen(true);
                }}
                className='es-focus-ring es-cta-button es-cta-primary mt-7 h-[58px] w-full rounded-[10px] px-5 text-base font-semibold'
              >
                {content.confirmAndPayLabel}
              </button>
            </aside>
          </div>
        </div>
      </SectionShell>

      {isPaymentModalOpen && (
        <MyBestAuntieBookingModal
          content={content.paymentModal}
          initialMonthId={modalMonthId}
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
