import type { ReactNode } from 'react';

import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { BookingEventDetailsPriceVenue } from '@/components/sections/booking-modal/booking-event-details-price-venue';
import type { BookingPaymentModalContent, Locale } from '@/content';

export interface BookingEventDetailPart {
  date: string;
  /** Event booking modal: single description under the session date. */
  description?: string;
}

interface BookingEventDetailsProps {
  locale: Locale;
  headingId: string;
  title: string;
  subtitle: string;
  content: BookingPaymentModalContent;
  activePartRows: BookingEventDetailPart[];
  originalAmount: number;
  venueName: string;
  venueAddress: string;
  /** When missing or not an http(s) URL, the directions link is hidden (e.g. at-home services). */
  directionHref?: string;
  detailsVariant?: 'event' | 'my-best-auntie';
  /**
   * Consultation booking: replaces the event date list in the left column (still uses
   * `detailsVariant='event'` for layout).
   */
  consultationScheduleSlot?: ReactNode;
}

const PART_CHIP_TONES = ['blue', 'green', 'yellow'] as const;
type PartChipTone = (typeof PART_CHIP_TONES)[number];

function resolvePartChipTone(index: number): PartChipTone {
  return PART_CHIP_TONES[index] ?? PART_CHIP_TONES[PART_CHIP_TONES.length - 1];
}

function getPartChipClassName(index: number): string {
  return `es-my-best-auntie-booking-part-chip es-my-best-auntie-booking-part-chip--${resolvePartChipTone(index)}`;
}

function getPartLineClassName(index: number, isLastItem: boolean): string {
  const tone = resolvePartChipTone(index);
  const baseClassName = `es-my-best-auntie-booking-part-line es-my-best-auntie-booking-part-line--tone-${tone}`;

  if (isLastItem) {
    return `${baseClassName} ${
      index === 0
        ? 'es-my-best-auntie-booking-part-line--last-first'
        : 'es-my-best-auntie-booking-part-line--last-stacked'
    }`;
  }

  return `${baseClassName} ${
    index === 0
      ? 'es-my-best-auntie-booking-part-line--with-gap-first'
      : 'es-my-best-auntie-booking-part-line--with-gap-stacked'
  }`;
}

function getPartGapConnectorClassName(index: number): string {
  return `es-my-best-auntie-booking-part-gap-connector es-my-best-auntie-booking-part-gap-connector--${resolvePartChipTone(index)}`;
}

export function BookingEventDetails({
  locale,
  headingId,
  title,
  subtitle,
  content,
  activePartRows,
  originalAmount,
  venueName,
  venueAddress,
  directionHref = '',
  detailsVariant = 'my-best-auntie',
  consultationScheduleSlot,
}: BookingEventDetailsProps) {
  const isEventDetailsVariant = detailsVariant === 'event';
  const eventScheduleRows = activePartRows
    .map((part) => part.date.trim())
    .filter((date): date is string => Boolean(date));

  return (
    <div className='es-my-best-auntie-booking-modal-details-column w-full lg:w-[calc(50%-20px)]'>
      <h2
        id={headingId}
        className='es-type-title es-my-best-auntie-booking-modal-heading'
      >
        {title}
      </h2>
      <p className='mt-3 text-xl leading-7 es-text-heading'>
        {subtitle}
      </p>

      {!isEventDetailsVariant ? (
        <section className='mt-8'>
          <ul className='space-y-[50px]'>
            {activePartRows.map((part, index) => {
              return (
                <li
                  key={index}
                  className='es-my-best-auntie-booking-part-item relative'
                >
                  <span
                    className='pointer-events-none absolute left-0 top-0 h-full'
                    aria-hidden='true'
                  >
                    <span
                      data-course-part-line='segment'
                      className={`absolute left-0 ${getPartLineClassName(
                        index,
                        index === activePartRows.length - 1,
                      )}`}
                    />
                  </span>
                  <div className='relative z-10 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:gap-x-4'>
                    <span
                      data-course-part-chip='true'
                      className={`relative inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${getPartChipClassName(index)}`}
                    >
                      <span
                        data-course-part-line='gap-connector'
                        className={`pointer-events-none absolute -left-[25px] top-1/2 -translate-y-1/2 ${getPartGapConnectorClassName(index)}`}
                        aria-hidden='true'
                      />
                      <span
                        data-course-part-icon='true'
                        className='es-mask-calendar-current h-7 w-7 shrink-0 text-black'
                        aria-hidden='true'
                      />
                    </span>

                    <div
                      data-course-part-date-block='true'
                      className='flex min-w-0 flex-col gap-2'
                    >
                      <p className='min-w-0 text-[17px] font-semibold leading-6 es-text-heading'>
                        {part.date}
                      </p>
                      {part.description?.trim() ? (
                        <p
                          data-course-part-schedule-block='true'
                          className='whitespace-pre-line text-[15px] leading-[22px] es-text-body'
                        >
                          {renderQuotedDescriptionText(part.description)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {isEventDetailsVariant ? (
        <section className='mt-9 border-t border-black/15 pt-8'>
          {consultationScheduleSlot ? (
            <div className='border-b border-black/15 pb-8'>{consultationScheduleSlot}</div>
          ) : null}
          {!consultationScheduleSlot && eventScheduleRows.length > 0 ? (
            <div data-event-schedule-summary='true' className='border-b border-black/15 pb-8'>
              <div className='flex items-center gap-4'>
                <span className='es-icon-circle-lg'>
                  <span
                    data-event-schedule-icon='true'
                    className='es-mask-calendar-danger h-[37px] w-[37px] shrink-0'
                    aria-hidden='true'
                  />
                </span>
                <div className='space-y-2'>
                  {eventScheduleRows.map((row, index) => (
                    <p
                      key={`${row}-${index}`}
                      data-event-schedule-row='true'
                      className='text-[26px] font-bold leading-none es-text-heading'
                    >
                      {row}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <BookingEventDetailsPriceVenue
            locale={locale}
            content={content}
            originalAmount={originalAmount}
            venueName={venueName}
            venueAddress={venueAddress}
            directionHref={directionHref}
            embedded
            isEventSpacing
          />
        </section>
      ) : (
        <BookingEventDetailsPriceVenue
          locale={locale}
          content={content}
          originalAmount={originalAmount}
          venueName={venueName}
          venueAddress={venueAddress}
          directionHref={directionHref}
        />
      )}
    </div>
  );
}
