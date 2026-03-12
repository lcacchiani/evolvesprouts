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
import { sortUpcomingEvents } from '@/lib/events-data';

interface EventsProps {
  content: EventsContent;
  locale?: string;
}

export function Events({
  content,
  locale = 'en',
}: EventsProps) {
  const {
    visibleEvents,
    isLoading,
    hasRequestError,
  } = useEventCards({
    content,
    locale,
    sortEventCards: sortUpcomingEvents,
  });

  return (
    <SectionShell
      id='events'
      ariaLabel={content.title}
      dataFigmaNode='events'
      className='es-events-section pt-0 sm:pt-[60px]'
    >
      <SectionContainer>
        <SectionHeader
          title={content.title}
          titleAs='h1'
          description={content.description}
          descriptionClassName='es-type-body mt-4'
        />
        <div className='mt-10 sm:mt-12'>
          {isLoading ? (
            <EventsLoadingState
              label={content.loadingLabel}
              testId='events-loading-gear'
            />
          ) : visibleEvents.length === 0 ? (
            <div className='rounded-panel border es-border-event-card es-bg-surface-event-card px-5 py-7 text-center sm:px-8 sm:py-10'>
              <p className='es-events-card-body'>{content.emptyStateLabel}</p>
              {hasRequestError && (
                <p className='mt-3 text-sm text-black/60'>{content.errorLabel}</p>
              )}
            </div>
          ) : (
            <EventCardsList content={content} events={visibleEvents} />
          )}
        </div>
      </SectionContainer>
    </SectionShell>
  );
}
