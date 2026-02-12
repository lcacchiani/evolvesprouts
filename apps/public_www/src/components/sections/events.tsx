'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { EventsContent } from '@/content';
import {
  readCandidateText,
  readOptionalText,
} from '@/content/content-field-utils';

interface EventsProps {
  content: EventsContent;
}

interface SortOption {
  value: string;
  label: string;
}

type EventStatus = 'open' | 'fully_booked';

interface EventCardData {
  id: string;
  title: string;
  summary?: string;
  dateLabel?: string;
  timeLabel?: string;
  locationName?: string;
  locationAddress?: string;
  ctaHref: string;
  ctaLabel: string;
  tags: string[];
  status: EventStatus;
  timestamp: number | null;
}

const SECTION_BACKGROUND = '#FFFFFF';
const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_TEXT_COLOR = 'var(--figma-colors-home, #4A4A4A)';

const DEFAULT_SORT_OPTIONS: readonly SortOption[] = [
  { value: 'latest', label: 'Latest Events' },
  { value: 'oldest', label: 'Older Events' },
  { value: 'fully_booked', label: 'Fully Booked' },
];

const eyebrowStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1',
};

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

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function sanitizeExternalHref(value: string | undefined): string {
  const href = readOptionalText(value);
  if (!href || !isExternalHref(href)) {
    return '';
  }

  return href;
}

function parseTimestamp(value: string | undefined): number | null {
  const text = readOptionalText(value);
  if (!text) {
    return null;
  }

  const parsedTimestamp = Date.parse(text);
  if (Number.isNaN(parsedTimestamp)) {
    return null;
  }

  return parsedTimestamp;
}

function resolveSortOptions(content: EventsContent): readonly SortOption[] {
  const normalizedOptions = content.sortOptions
    .map((option) => {
      const value = readOptionalText(option.value);
      const label = readOptionalText(option.label);
      if (!value || !label) {
        return null;
      }

      return { value, label };
    })
    .filter((option): option is SortOption => option !== null);

  if (normalizedOptions.length === 0) {
    return DEFAULT_SORT_OPTIONS;
  }

  return normalizedOptions;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const rawText = await response.text();
  const normalizedText = rawText.trim();

  if (!normalizedText) {
    return null;
  }

  try {
    return JSON.parse(normalizedText) as unknown;
  } catch {
    return normalizedText;
  }
}

async function fetchEventsPayload(
  apiUrl: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(apiUrl, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Events API request failed: ${response.status}`);
  }

  return parseResponsePayload(response);
}

function findEventsArray(payload: unknown, depth = 0): unknown[] {
  if (depth > 6) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const record = toRecord(payload);
  if (!record) {
    return [];
  }

  const directArrayKeys = ['events', 'items', 'results', 'records'];
  for (const key of directArrayKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  const nestedKeys = ['data', 'payload', 'result', 'response'];
  for (const key of nestedKeys) {
    const nested = findEventsArray(record[key], depth + 1);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

function readTagList(record: Record<string, unknown>): string[] {
  const tagKeys = ['tags', 'chips', 'categories'];

  for (const key of tagKeys) {
    const value = record[key];

    if (Array.isArray(value)) {
      const tags = value
        .map((item) => {
          if (typeof item === 'string') {
            return readOptionalText(item);
          }
          const itemRecord = toRecord(item);
          if (!itemRecord) {
            return undefined;
          }

          return readCandidateText(itemRecord, ['label', 'title', 'name']);
        })
        .filter((item): item is string => Boolean(item));

      if (tags.length > 0) {
        return tags;
      }
    }

    if (typeof value === 'string') {
      const tags = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (tags.length > 0) {
        return tags;
      }
    }
  }

  return [];
}

function resolveEventStatus(record: Record<string, unknown>): EventStatus {
  const statusText = readCandidateText(record, [
    'status',
    'bookingStatus',
    'availability',
  ]);

  if (statusText) {
    const normalizedStatus = statusText.toLowerCase();
    if (
      normalizedStatus.includes('full') ||
      normalizedStatus.includes('booked') ||
      normalizedStatus.includes('sold')
    ) {
      return 'fully_booked';
    }
  }

  const fullStateKeys = ['isFullyBooked', 'fullyBooked', 'soldOut', 'isSoldOut'];
  for (const key of fullStateKeys) {
    if (record[key] === true) {
      return 'fully_booked';
    }
  }

  return 'open';
}

function normalizeEventCard(
  value: unknown,
  index: number,
  content: EventsContent,
): EventCardData | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const title = readCandidateText(record, ['title', 'name', 'eventTitle']);
  if (!title) {
    return null;
  }

  const summary = readCandidateText(record, [
    'summary',
    'description',
    'details',
    'excerpt',
    'body',
  ]);

  const dateLabel = readCandidateText(record, [
    'dateLabel',
    'date',
    'eventDate',
    'startDateLabel',
    'dateDisplay',
  ]);
  const timeLabel = readCandidateText(record, [
    'timeLabel',
    'time',
    'eventTime',
    'startTimeLabel',
    'timeDisplay',
  ]);

  const timestamp =
    parseTimestamp(
      readCandidateText(record, [
        'startsAt',
        'startAt',
        'startDateTime',
        'startDate',
        'dateIso',
      ]),
    ) ?? parseTimestamp(dateLabel);

  const locationName = readCandidateText(record, [
    'locationName',
    'venue',
    'location',
  ]);
  const locationAddress = readCandidateText(record, [
    'locationAddress',
    'address',
    'venueAddress',
  ]);

  const ctaHref = sanitizeExternalHref(
    readCandidateText(record, [
      'ctaHref',
      'ctaUrl',
      'bookingUrl',
      'registrationUrl',
      'registerUrl',
      'href',
      'url',
      'link',
    ]),
  );
  const ctaLabel =
    readCandidateText(record, ['ctaLabel', 'buttonLabel', 'actionLabel']) ??
    content.card.ctaLabel;

  const rawId = readCandidateText(record, ['id', 'eventId', 'slug']) ?? '';
  const fallbackId = `${title}-${dateLabel ?? ''}-${index}`;
  const status = resolveEventStatus(record);
  const tags = readTagList(record);

  return {
    id: rawId || fallbackId,
    title,
    summary,
    dateLabel,
    timeLabel,
    locationName,
    locationAddress,
    ctaHref,
    ctaLabel,
    tags,
    status,
    timestamp,
  };
}

function normalizeEvents(payload: unknown, content: EventsContent): EventCardData[] {
  const eventsArray = findEventsArray(payload);

  return eventsArray
    .map((item, index) => normalizeEventCard(item, index, content))
    .filter((item): item is EventCardData => item !== null);
}

function sortEvents(events: EventCardData[], activeFilter: string): EventCardData[] {
  const entries = events.map((event, index) => ({ event, index }));

  if (activeFilter === 'fully_booked') {
    return entries
      .filter((entry) => entry.event.status === 'fully_booked')
      .map((entry) => entry.event);
  }

  if (activeFilter === 'latest' || activeFilter === 'oldest') {
    const isDescending = activeFilter === 'latest';
    entries.sort((left, right) => {
      const leftValue = left.event.timestamp;
      const rightValue = right.event.timestamp;

      if (leftValue === null && rightValue === null) {
        return left.index - right.index;
      }
      if (leftValue === null) {
        return 1;
      }
      if (rightValue === null) {
        return -1;
      }
      if (leftValue === rightValue) {
        return left.index - right.index;
      }

      return isDescending ? rightValue - leftValue : leftValue - rightValue;
    });
  }

  return entries.map((entry) => entry.event);
}

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
    const apiUrl = readOptionalText(content.apiUrl);

    if (!apiUrl) {
      setEvents([]);
      setHasRequestError(true);
      setIsLoading(false);
      return () => {
        controller.abort();
      };
    }

    setIsLoading(true);
    setHasRequestError(false);

    fetchEventsPayload(apiUrl, controller.signal)
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
