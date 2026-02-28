import type { SiteContent } from '@/content';
import { EventsPageSections } from '@/components/pages/events';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  createPublicCrmApiClient,
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  type EventCardData,
  fetchEventsPayload,
  normalizeEvents,
} from '@/lib/events-data';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';
import {
  buildBreadcrumbSchema,
  buildEventSchemas,
} from '@/lib/structured-data';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';
const EVENTS_FETCH_TIMEOUT_MS = 5000;

async function resolveServerSideEvents(
  locale: string,
  content: SiteContent,
): Promise<EventCardData[]> {
  const crmApiClient = createPublicCrmApiClient();
  if (!crmApiClient) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, EVENTS_FETCH_TIMEOUT_MS);

  try {
    const payload = await fetchEventsPayload(crmApiClient, controller.signal);
    return normalizeEvents(payload, content.events, locale);
  } catch (error) {
    if (isAbortRequestError(error)) {
      return [];
    }

    console.error('[events] Failed to fetch events payload.', error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = getMenuLabel(content, ROUTES.events, 'Events');
  const description = content.events.description;

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.events,
    title,
    description,
    socialImage: {
      url: content.seo.socialImages.events.url,
      alt: content.seo.socialImages.events.alt,
    },
  });
}

export default async function EventsPage({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle = getMenuLabel(content, ROUTES.events, 'Events');
  const eventsForSchema = await resolveServerSideEvents(locale, content);

  return (
    <>
      <EventsPageSections content={content} />
      <StructuredDataScript
        id={`events-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(content, ROUTES.home, 'Home'),
              path: ROUTES.home,
            },
            {
              name: pageTitle,
              path: ROUTES.events,
            },
          ],
        })}
      />
      <StructuredDataScript
        id={`events-jsonld-${locale}`}
        data={buildEventSchemas({
          locale,
          events: eventsForSchema,
        })}
      />
    </>
  );
}
