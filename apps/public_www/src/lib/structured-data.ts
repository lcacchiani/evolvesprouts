import type { Locale, SiteContent } from '@/content';
import type { EventCardData } from '@/lib/events-data';
import { ROUTES, type AppRoutePath } from '@/lib/routes';
import { SITE_ORIGIN, localizePath } from '@/lib/seo';
import { resolvePublicSiteConfig } from '@/lib/site-config';

export type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdValue[];
export type JsonLdObject = {
  [key: string]: JsonLdValue | undefined;
};

const SCHEMA_CONTEXT = 'https://schema.org';
const EVENT_ATTENDANCE_MODE_ONLINE = `${SCHEMA_CONTEXT}/OnlineEventAttendanceMode`;
const EVENT_ATTENDANCE_MODE_OFFLINE = `${SCHEMA_CONTEXT}/OfflineEventAttendanceMode`;
const EVENT_STATUS_SCHEDULED = `${SCHEMA_CONTEXT}/EventScheduled`;
const OFFER_AVAILABILITY_IN_STOCK = `${SCHEMA_CONTEXT}/InStock`;
const OFFER_AVAILABILITY_SOLD_OUT = `${SCHEMA_CONTEXT}/SoldOut`;
const ORGANIZATION_SCHEMA_ID = `${SITE_ORIGIN}#organization`;
const LOCAL_BUSINESS_SCHEMA_ID = `${SITE_ORIGIN}#local-business`;

function buildCourseSchemaId(locale: Locale): string {
  return `${toLocalizedAbsoluteUrl(ROUTES.servicesMyBestAuntieTrainingCourse, locale)}#course`;
}

function buildEventSchemaId(locale: Locale, eventId: string): string {
  const encodedEventId = encodeURIComponent(eventId.trim() || 'event');
  return `${toLocalizedAbsoluteUrl(ROUTES.events, locale)}#event-${encodedEventId}`;
}

function toAbsoluteUrl(path: string): string {
  try {
    return new URL(path, SITE_ORIGIN).toString();
  } catch {
    return SITE_ORIGIN;
  }
}

function toLocalizedAbsoluteUrl(routePath: AppRoutePath, locale: Locale): string {
  return `${SITE_ORIGIN}${localizePath(routePath, locale)}`;
}

function compactJsonLdValue(value: JsonLdValue | undefined): JsonLdValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const compacted = value
      .map((entry) => compactJsonLdValue(entry))
      .filter((entry): entry is JsonLdValue => entry !== undefined);
    return compacted.length > 0 ? compacted : undefined;
  }

  if (value && typeof value === 'object') {
    const compactedObject = compactJsonLdObject(value as JsonLdObject);
    return Object.keys(compactedObject).length > 0 ? compactedObject : undefined;
  }

  return value;
}

function compactJsonLdObject(object: JsonLdObject): JsonLdObject {
  const output: JsonLdObject = {};
  for (const [key, value] of Object.entries(object)) {
    const compacted = compactJsonLdValue(value);
    if (compacted !== undefined) {
      output[key] = compacted;
    }
  }

  return output;
}

function resolveSocialProfiles(): string[] {
  const { instagramUrl, linkedinUrl, whatsappUrl } = resolvePublicSiteConfig();
  return [instagramUrl, linkedinUrl, whatsappUrl].filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim() !== '',
  );
}

interface SharedStructuredDataOptions {
  locale: Locale;
  content: SiteContent;
}

export function buildOrganizationSchema({
  locale,
  content,
}: SharedStructuredDataOptions): JsonLdObject {
  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    '@id': ORGANIZATION_SCHEMA_ID,
    name: content.navbar.brand,
    url: toLocalizedAbsoluteUrl(ROUTES.home, locale),
    logo: toAbsoluteUrl(content.navbar.logoSrc || '/images/evolvesprouts-logo.svg'),
    description: content.seo.organizationDescription,
    sameAs: resolveSocialProfiles(),
  });
}

export function buildLocalBusinessSchema({
  locale,
  content,
}: SharedStructuredDataOptions): JsonLdObject {
  const { businessAddress, businessPhoneNumber } = resolvePublicSiteConfig();

  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'LocalBusiness',
    '@id': LOCAL_BUSINESS_SCHEMA_ID,
    name: content.seo.localBusinessName || content.navbar.brand,
    description: content.seo.localBusinessDescription,
    url: toLocalizedAbsoluteUrl(ROUTES.home, locale),
    image: toAbsoluteUrl(content.navbar.logoSrc || '/images/evolvesprouts-logo.svg'),
    telephone: businessPhoneNumber,
    address: businessAddress
      ? {
          '@type': 'PostalAddress',
          streetAddress: businessAddress,
          addressLocality: 'Hong Kong',
          addressCountry: 'HK',
        }
      : undefined,
    areaServed: content.seo.localBusinessAreaServed,
    sameAs: resolveSocialProfiles(),
    parentOrganization: {
      '@id': ORGANIZATION_SCHEMA_ID,
    },
  });
}

interface BreadcrumbItem {
  name: string;
  path: AppRoutePath;
}

interface BreadcrumbSchemaOptions {
  locale: Locale;
  items: BreadcrumbItem[];
}

export function buildBreadcrumbSchema({
  locale,
  items,
}: BreadcrumbSchemaOptions): JsonLdObject {
  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toLocalizedAbsoluteUrl(item.path, locale),
    })),
  });
}

export function buildFaqPageSchema(
  faq: SiteContent['faq'],
): JsonLdObject {
  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: faq.questions.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  });
}

export function buildCourseSchema({
  locale,
  content,
}: SharedStructuredDataOptions): JsonLdObject {
  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'Course',
    '@id': buildCourseSchemaId(locale),
    name: content.seo.trainingCourse.title,
    description: content.seo.trainingCourse.description,
    url: toLocalizedAbsoluteUrl(ROUTES.servicesMyBestAuntieTrainingCourse, locale),
    provider: {
      '@id': ORGANIZATION_SCHEMA_ID,
    },
  });
}

function resolveEventAttendanceMode(event: EventCardData): string {
  const normalizedLocation = event.locationName?.toLowerCase() ?? '';
  if (normalizedLocation.includes('virtual')) {
    return EVENT_ATTENDANCE_MODE_ONLINE;
  }

  return EVENT_ATTENDANCE_MODE_OFFLINE;
}

function resolveEventLocation(event: EventCardData, locale: Locale): JsonLdObject {
  if (resolveEventAttendanceMode(event) === EVENT_ATTENDANCE_MODE_ONLINE) {
    return {
      '@type': 'VirtualLocation',
      url: event.ctaHref ? toAbsoluteUrl(event.ctaHref) : toLocalizedAbsoluteUrl(ROUTES.events, locale),
    };
  }

  return compactJsonLdObject({
    '@type': 'Place',
    name: event.locationName,
    address: event.locationAddress,
  });
}

function resolveEventOffer(
  event: EventCardData,
  locale: Locale,
): JsonLdObject | undefined {
  if (!event.ctaHref) {
    return undefined;
  }

  return compactJsonLdObject({
    '@type': 'Offer',
    url: toAbsoluteUrl(event.ctaHref),
    availability: event.status === 'fully_booked'
      ? OFFER_AVAILABILITY_SOLD_OUT
      : OFFER_AVAILABILITY_IN_STOCK,
    category: 'Course',
    seller: {
      '@id': ORGANIZATION_SCHEMA_ID,
    },
  });
}

interface EventSchemaOptions {
  locale: Locale;
  events: EventCardData[];
}

export function buildEventSchemas({
  locale,
  events,
}: EventSchemaOptions): JsonLdObject[] {
  return events
    .filter((event) => event.timestamp !== null)
    .map((event) =>
      compactJsonLdObject({
        '@context': SCHEMA_CONTEXT,
        '@type': 'Event',
        '@id': buildEventSchemaId(locale, event.id),
        name: event.title,
        description: event.summary,
        startDate:
          event.timestamp === null ? undefined : new Date(event.timestamp).toISOString(),
        eventStatus: EVENT_STATUS_SCHEDULED,
        eventAttendanceMode: resolveEventAttendanceMode(event),
        location: resolveEventLocation(event, locale),
        organizer: {
          '@id': ORGANIZATION_SCHEMA_ID,
        },
        offers: resolveEventOffer(event, locale),
      }),
    )
    .filter((entry) => Object.keys(entry).length > 0);
}
