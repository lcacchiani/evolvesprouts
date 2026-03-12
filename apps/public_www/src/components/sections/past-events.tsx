'use client';

import { SectionContainer } from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import {
  EventCardsList,
  EventsLoadingState,
  useEventCards,
} from '@/components/sections/shared/events-shared';
import type { EventsContent } from '@/content';
import { sortPastEvents } from '@/lib/events-data';

interface PastEventsProps {
  content: EventsContent;
  locale?: string;
}

export function PastEvents({
  content,
  locale = 'en',
}: PastEventsProps) {
  const {
    visibleEvents,
    isLoading,
    hasRequestError,
  } = useEventCards({
    content,
    locale,
    sortEventCards: sortPastEvents,
  });

  return (
    <SectionShell
      id='past-events'
      ariaLabel={content.past.title}
      dataFigmaNode='past-events'
      className='es-events-section sm:pt-[60px]'
    >
      <SectionContainer>
        <SectionHeader
          title={content.past.title}
          titleAs='h2'
          descriptionClassName='es-type-body mt-4'
        />
        <div className='mt-8'>
          {isLoading ? (
            <EventsLoadingState
              label={content.loadingLabel}
              testId='past-events-loading-gear'
            />
          ) : visibleEvents.length === 0 ? (
            <div className='rounded-panel border es-border-event-card es-bg-surface-event-card px-5 py-7 text-center sm:px-8 sm:py-10'>
              <p className='es-events-card-body'>{content.past.emptyStateLabel}</p>
              {hasRequestError && (
                <p className='mt-3 text-sm text-black/60'>{content.errorLabel}</p>
              )}
            </div>
          ) : (
            <EventCardsList
              content={content}
              events={visibleEvents}
              showBookingAction={false}
            />
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
