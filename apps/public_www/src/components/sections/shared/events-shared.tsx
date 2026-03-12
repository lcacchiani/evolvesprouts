'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import type { EventsContent } from '@/content';
import {
  createPublicCrmApiClient,
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  type EventCardData,
  fetchEventsPayload,
  normalizeEvents,
} from '@/lib/events-data';

const CALENDAR_ICON_SRC = '/images/calendar.svg';
const CLOCK_ICON_SRC = '/images/clock.svg';
const LOCATION_ICON_SRC = '/images/location.svg';

interface LoadingGearIconProps {
  className?: string;
  testId: string;
}

interface EventsLoadingStateProps {
  label: string;
  testId: string;
}

interface EventCardsListProps {
  content: EventsContent;
  events: EventCardData[];
}

type SortEventCardsFn = (events: EventCardData[]) => EventCardData[];

interface UseEventCardsOptions {
  content: EventsContent;
  locale: string;
  sortEventCards: SortEventCardsFn;
}

interface UseEventCardsResult {
  visibleEvents: EventCardData[];
  isLoading: boolean;
  hasRequestError: boolean;
}

function LoadingGearIcon({ className, testId }: LoadingGearIconProps) {
  return (
    <svg
      data-testid={testId}
      aria-hidden='true'
      viewBox='0 0 24 24'
      className={`es-events-loading-gear ${className ?? ''}`.trim()}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
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

export function EventsLoadingState({ label, testId }: EventsLoadingStateProps) {
  return (
    <div className='flex flex-col items-center gap-3 py-6 text-center sm:py-8'>
      <span
        role='status'
        aria-label={label}
        className='inline-flex h-12 w-12 items-center justify-center rounded-full border es-border-soft es-events-loading-bubble'
      >
        <LoadingGearIcon className='h-7 w-7 animate-spin' testId={testId} />
      </span>
      <p className='es-events-card-body'>{label}</p>
    </div>
  );
}

export function EventCardsList({
  content,
  events,
}: EventCardsListProps) {
  return (
    <ul className='space-y-6'>
      {events.map((eventCard) => (
        <li key={eventCard.id}>
          <article className='rounded-panel es-bg-surface-event-card p-5 sm:p-6 lg:flex lg:items-start lg:justify-between lg:gap-7 lg:p-8'>
            <div className='w-full lg:max-w-[720px]'>
              <div className='flex flex-wrap items-center gap-2'>
                {eventCard.tags.map((tag) => (
                  <span
                    key={`${eventCard.id}-${tag}`}
                    className='inline-flex rounded-3xl border es-border-soft es-bg-peach-glass px-[13px] py-[7px] es-events-card-tag'
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h3 className='mt-4 text-balance es-events-card-title'>
                {eventCard.title}
              </h3>

              {eventCard.summary && (
                <p className='mt-2 es-events-card-body'>
                  {eventCard.summary}
                </p>
              )}

              <ul className='mt-5 flex flex-wrap items-center gap-2'>
                {eventCard.dateLabel && (
                  <li
                    className='inline-flex items-center gap-1.5 rounded-3xl bg-white px-3 py-[7px] es-events-detail-chip'
                  >
                    <Image
                      src={CALENDAR_ICON_SRC}
                      alt=''
                      aria-hidden='true'
                      width={14}
                      height={14}
                      className='h-3.5 w-3.5'
                    />
                    <span>
                      {content.card.dateLabel}: {eventCard.dateLabel}
                    </span>
                  </li>
                )}
                {eventCard.timeLabel && (
                  <li
                    className='inline-flex items-center gap-1.5 rounded-3xl bg-white px-3 py-[7px] es-events-detail-chip'
                  >
                    <Image
                      src={CLOCK_ICON_SRC}
                      alt=''
                      aria-hidden='true'
                      width={14}
                      height={14}
                      className='h-3.5 w-3.5'
                    />
                    <span>
                      {content.card.timeLabel}: {eventCard.timeLabel}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <aside className='mt-6 w-full rounded-lg bg-white px-4 py-5 lg:mt-0 lg:max-w-[335px]'>
              <h4 className='es-events-location-heading'>
                {content.card.locationLabel}
              </h4>
              <p className='mt-2 es-events-location-text'>
                {eventCard.locationName ?? content.card.emptyLocationLabel}
              </p>
              {eventCard.locationAddress && (
                <p className='mt-1 es-events-location-text'>
                  {eventCard.locationAddress}
                </p>
              )}

              <div className='mt-5'>
                {eventCard.status === 'fully_booked' ? (
                  <span
                    className='inline-flex items-center gap-1 rounded-3xl es-bg-surface-danger-soft px-3 py-[9px] es-events-detail-chip es-events-detail-chip-danger'
                  >
                    <Image
                      src={LOCATION_ICON_SRC}
                      alt=''
                      aria-hidden='true'
                      width={14}
                      height={14}
                      className='h-3.5 w-3.5'
                    />
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
  );
}

export function useEventCards({
  content,
  locale,
  sortEventCards,
}: UseEventCardsOptions): UseEventCardsResult {
  const crmApiClient = useMemo(() => createPublicCrmApiClient(), []);
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [isLoading, setIsLoading] = useState(() => crmApiClient !== null);
  const [hasRequestError, setHasRequestError] = useState(() => crmApiClient === null);

  useEffect(() => {
    const controller = new AbortController();

    if (!crmApiClient) {
      return () => {
        controller.abort();
      };
    }

    fetchEventsPayload(crmApiClient, controller.signal)
      .then((payload) => {
        const normalizedEvents = normalizeEvents(payload, content, locale);
        setHasRequestError(false);
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
  }, [content, locale, crmApiClient]);

  const visibleEvents = useMemo(() => {
    return sortEventCards(events);
  }, [events, sortEventCards]);

  return {
    visibleEvents,
    isLoading,
    hasRequestError,
  };
}
