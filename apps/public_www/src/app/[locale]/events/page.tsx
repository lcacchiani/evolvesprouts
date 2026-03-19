import type { SiteContent } from '@/content';
import { EventsPage } from '@/components/pages/events';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import {
  createPublicCrmApiClient,
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  type EventCardData,
  fetchEventsPayload,
  normalizeEventsForEventsPage,
  shouldUseTemporaryEventsContentSource,
} from '@/lib/events-data';
import {
  getMenuLabel,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { reportInternalError } from '@/lib/internal-error-reporting';
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
  const useTemporaryEventsSource = shouldUseTemporaryEventsContentSource();
  const crmApiClient = createPublicCrmApiClient();
  if (!crmApiClient && !useTemporaryEventsSource) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, EVENTS_FETCH_TIMEOUT_MS);

  try {
    const payload = await fetchEventsPayload(crmApiClient, controller.signal);
    return normalizeEventsForEventsPage(payload, content.events, locale);
  } catch (error) {
    if (isAbortRequestError(error)) {
      return [];
    }

    // Fail closed for data fetching while preserving page rendering.
    reportInternalError({
      context: 'events-page-fetch',
      error,
      metadata: { locale },
    });
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const title = content.seo.events.title || getMenuLabel(content, ROUTES.events);
  const description = content.seo.events.description;

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

export default async function EventsRoutePage({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const pageTitle = getMenuLabel(content, ROUTES.events);
  const eventsForSchema = await resolveServerSideEvents(locale, content);

  return (
    <>
      <EventsPage content={content} />
      <StructuredDataScript
        id={`events-breadcrumb-jsonld-${locale}`}
        data={buildBreadcrumbSchema({
          locale,
          items: [
            {
              name: getMenuLabel(content, ROUTES.home),
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
