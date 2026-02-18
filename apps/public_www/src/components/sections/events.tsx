'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import {
  CalendarIcon,
  ClockIcon,
  LocationIcon,
} from '@/components/sections/navbar-icons';
import { SectionShell } from '@/components/section-shell';
import type { EventsContent } from '@/content';
import {
  createPublicCrmApiClient,
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  BRAND_ORANGE_SOFT,
  BRAND_PEACH_BG,
  bodyTextStyle,
  BODY_TEXT_COLOR,
  headingTextStyle,
  HEADING_TEXT_COLOR,
  SURFACE_WHITE,
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

const SECTION_BACKGROUND = SURFACE_WHITE;
const LOADING_GEAR_COLOR = BRAND_ORANGE_SOFT;
const LOADING_GEAR_BACKGROUND = BRAND_PEACH_BG;

const scheduledHeadingStyle: CSSProperties = headingTextStyle({
  fontSize: 'clamp(1.45rem, 3.5vw, 32px)',
  fontWeight: 600,
  lineHeight: '1.2',
});

const filterSelectStyle: CSSProperties = bodyTextStyle({
  color: HEADING_TEXT_COLOR,
  fontSize: '17px',
  fontWeight: 600,
  lineHeight: '1',
});

const cardTagStyle: CSSProperties = headingTextStyle({
  fontSize: '11px',
  fontWeight: 500,
  lineHeight: '1',
  textTransform: 'uppercase',
  letterSpacing: '0',
});

const cardTitleStyle: CSSProperties = headingTextStyle({
  fontSize: 'clamp(1.4rem, 3vw, 32px)',
  fontWeight: 600,
  lineHeight: '1.25',
});

const cardBodyStyle: CSSProperties = bodyTextStyle({
  fontSize: '16px',
  lineHeight: '1.6',
});

const detailChipStyle: CSSProperties = headingTextStyle({
  fontSize: '11px',
  fontWeight: 500,
  lineHeight: '1',
  letterSpacing: '0',
});

const locationHeadingStyle: CSSProperties = headingTextStyle({
  fontSize: '18px',
  fontWeight: 600,
  lineHeight: '1.25',
});

const locationTextStyle: CSSProperties = bodyTextStyle({
  fontSize: '16px',
  fontWeight: 500,
  lineHeight: '1.45',
});

interface LoadingGearIconProps {
  className?: string;
}

function LoadingGearIcon({ className }: LoadingGearIconProps) {
  return (
    <svg
      data-testid='events-loading-gear'
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={className}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={{ color: LOADING_GEAR_COLOR }}
    >
      <circle cx='12' cy='12' r='3.25' stroke='currentColor' strokeWidth='1.8' />
      <path d='M12 2.75V5.25' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path d='M12 18.75V21.25' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path d='M2.75 12H5.25' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path d='M18.75 12H21.25' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
      <path
        d='M5.46 5.46L7.23 7.23'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        d='M16.77 16.77L18.54 18.54'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        d='M5.46 18.54L7.23 16.77'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        d='M16.77 7.23L18.54 5.46'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
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
    const crmApiClient = createPublicCrmApiClient();

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
        if (isAbortRequestError(error)) {
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
          <h1 className='es-type-title text-balance'>
            {content.title}
          </h1>
          <p className='es-type-body mt-4 text-balance'>
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
              className='es-focus-ring w-full appearance-none rounded-[58px] border es-border-soft es-bg-peach-glass px-4 py-[17px] pr-10'
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
            <div className='flex flex-col items-center gap-3 py-6 text-center sm:py-8'>
              <span
                role='status'
                aria-label={content.loadingLabel}
                className='inline-flex h-12 w-12 items-center justify-center rounded-full border es-border-soft'
                style={{ backgroundColor: LOADING_GEAR_BACKGROUND }}
              >
                <LoadingGearIcon className='h-7 w-7 animate-spin' />
              </span>
              <p style={cardBodyStyle}>{content.loadingLabel}</p>
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className='rounded-[17px] border es-border-event-card es-bg-surface-event-card px-5 py-7 text-center sm:px-8 sm:py-10'>
              <p style={cardBodyStyle}>{content.emptyStateLabel}</p>
              {hasRequestError && (
                <p className='mt-3 text-sm text-black/60'>{content.errorLabel}</p>
              )}
            </div>
          ) : (
            <ul className='space-y-6'>
              {visibleEvents.map((eventCard) => (
                <li key={eventCard.id}>
                  <article className='rounded-[17px] es-bg-surface-event-card p-5 sm:p-6 lg:flex lg:items-start lg:justify-between lg:gap-7 lg:p-8'>
                    <div className='w-full lg:max-w-[720px]'>
                      <div className='flex flex-wrap items-center gap-2'>
                        {eventCard.tags.map((tag) => (
                          <span
                            key={`${eventCard.id}-${tag}`}
                            className='inline-flex rounded-[24px] border es-border-soft es-bg-peach-glass px-[13px] py-[7px]'
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
                            className='inline-flex items-center gap-1 rounded-[24px] es-bg-surface-danger-soft px-3 py-[9px]'
                            style={{
                              ...detailChipStyle,
                              color: 'var(--es-color-text-danger-chip, #D03C3C)',
                            }}
                          >
                            <LocationIcon />
                            <span>{content.card.fullyBookedLabel}</span>
                          </span>
                        ) : (
                          eventCard.ctaHref && (
                            <SectionCtaAnchor
                              href={eventCard.ctaHref}
                              className='w-full'
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
