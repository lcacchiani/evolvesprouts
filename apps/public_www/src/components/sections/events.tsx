'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { EventsContent } from '@/content';
import { createCrmApiClient } from '@/lib/crm-api-client';
import {
  BODY_TEXT_COLOR,
  DEFAULT_SECTION_EYEBROW_STYLE,
  HEADING_TEXT_COLOR,
} from '@/lib/design-tokens';
import {
  type EventCardData,
  fetchEventsPayload,
  normalizeEvents,
  resolveSortOptions,
  sortEvents,
} from '@/lib/events-data';

interface EventsProps {
  content: EventsContent;
}

const SECTION_BACKGROUND = '#FFFFFF';

const eyebrowStyle: CSSProperties = DEFAULT_SECTION_EYEBROW_STYLE;

const titleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(2.1rem, 5.6vw, 55px)',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  lineHeight: '1.12',
};

const descriptionStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'clamp(1rem, 2.2vw, 24px)',
  fontWeight: 400,
  lineHeight: '1.45',
  letterSpacing: '0.2px',
};

const scheduledHeadingStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.45rem, 3.5vw, 32px)',
  fontWeight: 600,
  lineHeight: '1.2',
};

const filterSelectStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '17px',
  fontWeight: 600,
  lineHeight: '1',
};

const cardTagStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: '11px',
  fontWeight: 500,
  lineHeight: '1',
  textTransform: 'uppercase',
  letterSpacing: '0',
};

const cardTitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'clamp(1.4rem, 3vw, 32px)',
  fontWeight: 600,
  lineHeight: '1.25',
};

const cardBodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '16px',
  fontWeight: 400,
  lineHeight: '1.6',
};

const detailChipStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: '11px',
  fontWeight: 500,
  lineHeight: '1',
  letterSpacing: '0',
};

const locationHeadingStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: '18px',
  fontWeight: 600,
  lineHeight: '1.25',
};

const locationTextStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '16px',
  fontWeight: 500,
  lineHeight: '1.45',
};

function CalendarIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-3.5 w-3.5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <rect x='2' y='3' width='12' height='11' rx='2' stroke='currentColor' />
      <path d='M2 6H14' stroke='currentColor' />
      <path d='M5 1.5V4.5' stroke='currentColor' strokeLinecap='round' />
      <path d='M11 1.5V4.5' stroke='currentColor' strokeLinecap='round' />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-3.5 w-3.5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle cx='8' cy='8' r='6' stroke='currentColor' />
      <path d='M8 4.8V8L10.3 9.6' stroke='currentColor' strokeLinecap='round' />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-3.5 w-3.5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M8 14C8 14 12 10.4 12 6.9C12 4.7 10.2 3 8 3C5.8 3 4 4.7 4 6.9C4 10.4 8 14 8 14Z'
        stroke='currentColor'
      />
      <circle cx='8' cy='6.8' r='1.5' stroke='currentColor' />
    </svg>
  );
}

export function Events({ content }: EventsProps) {
  const sortOptions = useMemo(() => resolveSortOptions(content), [content]);
  const defaultSortOptionValue = sortOptions[0]?.value ?? 'latest';
  const [activeFilter, setActiveFilter] = useState(defaultSortOptionValue);
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRequestError, setHasRequestError] = useState(false);

  useEffect(() => {
    setActiveFilter(defaultSortOptionValue);
  }, [defaultSortOptionValue]);

  useEffect(() => {
    const controller = new AbortController();
    const crmApiBaseUrl = process.env.NEXT_PUBLIC_WWW_CRM_API_BASE_URL ?? '';
    const crmApiKey = process.env.NEXT_PUBLIC_WWW_CRM_API_KEY ?? '';
    const crmApiClient = createCrmApiClient({
      baseUrl: crmApiBaseUrl,
      apiKey: crmApiKey,
    });

    if (!crmApiClient) {
      setEvents([]);
      setHasRequestError(true);
      setIsLoading(false);
      return () => {
        controller.abort();
      };
    }

    setIsLoading(true);
    setHasRequestError(false);

    fetchEventsPayload(crmApiClient, controller.signal)
      .then((payload) => {
        const normalizedEvents = normalizeEvents(payload, content);
        setEvents(normalizedEvents);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setEvents([]);
        setHasRequestError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [content]);

  const visibleEvents = useMemo(() => {
    return sortEvents(events, activeFilter);
  }, [events, activeFilter]);

  return (
    <SectionShell
      id='events'
      ariaLabel={content.title}
      dataFigmaNode='events'
      style={{ backgroundColor: SECTION_BACKGROUND }}
    >
      <div className='mx-auto w-full max-w-[1465px]'>
        <div className='mx-auto max-w-[920px] text-center'>
          <SectionEyebrowChip
            label={content.eyebrow}
            labelStyle={eyebrowStyle}
            className='px-4 py-[11px] sm:px-5'
            style={{ borderColor: '#EECAB0' }}
          />
          <h1 className='mt-6 text-balance' style={titleStyle}>
            {content.title}
          </h1>
          <p className='mt-4 text-balance' style={descriptionStyle}>
            {content.description}
          </p>
        </div>

        <div className='mt-10 flex flex-col gap-4 sm:mt-12 sm:flex-row sm:items-center sm:justify-between'>
          <h2 style={scheduledHeadingStyle}>{content.scheduledHeading}</h2>
          <label className='relative inline-flex w-full max-w-[230px] items-center sm:w-auto'>
            <span className='sr-only'>{content.sortAriaLabel}</span>
            <select
              value={activeFilter}
              aria-label={content.sortAriaLabel}
              onChange={(event) => {
                setActiveFilter(event.target.value);
              }}
              className='es-focus-ring w-full appearance-none rounded-[58px] border border-[#EECAB0] bg-[#F6DECD24] px-4 py-[17px] pr-10'
              style={filterSelectStyle}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className='pointer-events-none absolute right-4 inline-flex h-4 w-4 items-center justify-center text-black/70'>
              <svg
                aria-hidden='true'
                viewBox='0 0 16 16'
                className='h-4 w-4'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M4 6L8 10L12 6'
                  stroke='currentColor'
                  strokeWidth='1.8'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </span>
          </label>
        </div>

        <div className='mt-8 sm:mt-10'>
          {isLoading ? (
            <p className='text-center' style={cardBodyStyle}>
              {content.loadingLabel}
            </p>
          ) : visibleEvents.length === 0 ? (
            <div className='rounded-[17px] border border-[#E7D5C9] bg-[#F4F6F8] px-5 py-7 text-center sm:px-8 sm:py-10'>
              <p style={cardBodyStyle}>{content.emptyStateLabel}</p>
              {hasRequestError && (
                <p className='mt-3 text-sm text-black/60'>{content.errorLabel}</p>
              )}
            </div>
          ) : (
            <ul className='space-y-6'>
              {visibleEvents.map((eventCard) => (
                <li key={eventCard.id}>
                  <article className='rounded-[17px] bg-[#F4F6F8] p-5 sm:p-6 lg:flex lg:items-start lg:justify-between lg:gap-7 lg:p-8'>
                    <div className='w-full lg:max-w-[720px]'>
                      <div className='flex flex-wrap items-center gap-2'>
                        {eventCard.tags.map((tag) => (
                          <span
                            key={`${eventCard.id}-${tag}`}
                            className='inline-flex rounded-[24px] border border-[#EECAB0] bg-[#F6DECD24] px-[13px] py-[7px]'
                            style={cardTagStyle}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <h3 className='mt-4 text-balance' style={cardTitleStyle}>
                        {eventCard.title}
                      </h3>

                      {eventCard.summary && (
                        <p className='mt-2' style={cardBodyStyle}>
                          {eventCard.summary}
                        </p>
                      )}

                      <ul className='mt-5 flex flex-wrap items-center gap-2'>
                        {eventCard.dateLabel && (
                          <li
                            className='inline-flex items-center gap-1.5 rounded-[24px] bg-white px-3 py-[7px]'
                            style={detailChipStyle}
                          >
                            <CalendarIcon />
                            <span>
                              {content.card.dateLabel}: {eventCard.dateLabel}
                            </span>
                          </li>
                        )}
                        {eventCard.timeLabel && (
                          <li
                            className='inline-flex items-center gap-1.5 rounded-[24px] bg-white px-3 py-[7px]'
                            style={detailChipStyle}
                          >
                            <ClockIcon />
                            <span>
                              {content.card.timeLabel}: {eventCard.timeLabel}
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>

                    <aside className='mt-6 w-full rounded-[8px] bg-white px-4 py-5 lg:mt-0 lg:max-w-[335px]'>
                      <h4 style={locationHeadingStyle}>{content.card.locationLabel}</h4>
                      <p className='mt-2' style={locationTextStyle}>
                        {eventCard.locationName ?? content.card.emptyLocationLabel}
                      </p>
                      {eventCard.locationAddress && (
                        <p className='mt-1' style={locationTextStyle}>
                          {eventCard.locationAddress}
                        </p>
                      )}

                      <div className='mt-5'>
                        {eventCard.status === 'fully_booked' ? (
                          <span
                            className='inline-flex items-center gap-1 rounded-[24px] bg-[#FFC3C3] px-3 py-[9px]'
                            style={{
                              ...detailChipStyle,
                              color: '#D03C3C',
                            }}
                          >
                            <LocationIcon />
                            <span>{content.card.fullyBookedLabel}</span>
                          </span>
                        ) : (
                          eventCard.ctaHref && (
                            <SectionCtaAnchor
                              href={eventCard.ctaHref}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='h-12 w-full rounded-[8px] px-4 text-base'
                            >
                              {eventCard.ctaLabel}
                            </SectionCtaAnchor>
                          )
                        )}
                      </div>
                    </aside>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
