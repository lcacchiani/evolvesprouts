import type {
  Locale,
  SiteContent,
} from '@/content';
import {
  filterFaqQuestionsForAudience,
  type FaqPageAudience,
} from '@/lib/faq-audiences';
import {
  getLandingPageStructuredDataContent,
  type EventCardData,
} from '@/lib/events-data';
import { ROUTES } from '@/lib/routes';
import { getSiteOrigin, localizePath } from '@/lib/seo';
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

function getOrganizationSchemaId(): string {
  return `${getSiteOrigin()}#organization`;
}

function getLocalBusinessSchemaId(): string {
  return `${getSiteOrigin()}#local-business`;
}

function getWebsiteSchemaId(): string {
  return `${getSiteOrigin()}#website`;
}

function buildCourseSchemaId(locale: Locale): string {
  return `${toLocalizedAbsoluteUrl(ROUTES.servicesMyBestAuntieTrainingCourse, locale)}#course`;
}

function buildEventSchemaId(locale: Locale, eventId: string): string {
  const encodedEventId = encodeURIComponent(eventId.trim() || 'event');
  return `${toLocalizedAbsoluteUrl(ROUTES.events, locale)}#event-${encodedEventId}`;
}

function toAbsoluteUrl(path: string): string {
  const siteOrigin = getSiteOrigin();
  try {
    return new URL(path, siteOrigin).toString();
  } catch {
    return siteOrigin;
  }
}

function toLocalizedAbsoluteUrl(routePath: string, locale: Locale): string {
  return `${getSiteOrigin()}${localizePath(routePath, locale)}`;
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
  const organizationSchemaId = getOrganizationSchemaId();
  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    '@id': organizationSchemaId,
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
  const localBusinessSchemaId = getLocalBusinessSchemaId();
  const organizationSchemaId = getOrganizationSchemaId();

  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'LocalBusiness',
    '@id': localBusinessSchemaId,
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
      '@id': organizationSchemaId,
    },
  });
}

export function buildWebSiteSchema({
  locale,
  content,
}: SharedStructuredDataOptions): JsonLdObject {
  const websiteSchemaId = getWebsiteSchemaId();
  const organizationSchemaId = getOrganizationSchemaId();

  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebSite',
    '@id': websiteSchemaId,
    name: content.navbar.brand,
    url: toLocalizedAbsoluteUrl(ROUTES.home, locale),
    description: content.seo.organizationDescription,
    inLanguage: [
      { '@type': 'Language', name: 'English', alternateName: 'en' },
      { '@type': 'Language', name: 'Chinese (Simplified)', alternateName: 'zh-CN' },
      { '@type': 'Language', name: 'Chinese (Traditional)', alternateName: 'zh-HK' },
    ],
    publisher: {
      '@id': organizationSchemaId,
    },
  });
}

interface BreadcrumbItem {
  name: string;
  path: string;
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

export function buildFaqJsonLd(
  entries: ReadonlyArray<{ question: string; answer: string }>,
): JsonLdObject {
  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  });
}

export function buildFaqPageSchema(
  faq: SiteContent['faq'],
  pageAudience?: FaqPageAudience,
): JsonLdObject {
  const questions = filterFaqQuestionsForAudience(faq.questions, pageAudience);
  return buildFaqJsonLd(questions);
}

export function buildCourseSchema({
  locale,
  content,
}: SharedStructuredDataOptions): JsonLdObject {
  const organizationSchemaId = getOrganizationSchemaId();
  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'Course',
    '@id': buildCourseSchemaId(locale),
    name: content.seo.trainingCourse.title,
    description: content.seo.trainingCourse.description,
    url: toLocalizedAbsoluteUrl(ROUTES.servicesMyBestAuntieTrainingCourse, locale),
    provider: {
      '@id': organizationSchemaId,
    },
  });
}

interface LandingPageEventSchemaOptions {
  locale: Locale;
  landingPageSlug: string;
  pagePath: string;
}

export function buildLandingPageEventSchema({
  locale,
  landingPageSlug,
  pagePath,
}: LandingPageEventSchemaOptions): JsonLdObject {
  const structuredData = getLandingPageStructuredDataContent(landingPageSlug);
  if (!structuredData) {
    return {};
  }

  const organizationSchemaId = getOrganizationSchemaId();

  const streetAddress = structuredData.locationAddress || structuredData.locationName;

  return compactJsonLdObject({
    '@context': SCHEMA_CONTEXT,
    '@type': 'Event',
    name: structuredData.eventName,
    description: structuredData.description,
    startDate: structuredData.startDate,
    endDate: structuredData.endDate,
    image: toAbsoluteUrl('/images/evolvesprouts-logo.svg'),
    eventStatus: EVENT_STATUS_SCHEDULED,
    eventAttendanceMode: EVENT_ATTENDANCE_MODE_OFFLINE,
    location: compactJsonLdObject({
      '@type': 'Place',
      name: structuredData.locationName,
      address: streetAddress
        ? compactJsonLdObject({
            '@type': 'PostalAddress',
            streetAddress,
            addressLocality: 'Hong Kong',
            addressCountry: 'HK',
          })
        : undefined,
    }),
    organizer: {
      '@id': organizationSchemaId,
    },
    performer: {
      '@id': organizationSchemaId,
    },
    offers: compactJsonLdObject({
      '@type': 'Offer',
      price: structuredData.offerPrice,
      priceCurrency: structuredData.offerCurrency,
      availability: `${SCHEMA_CONTEXT}/${structuredData.offerAvailability}`,
      validFrom: structuredData.startDate,
      url: `${getSiteOrigin()}${localizePath(pagePath, locale)}`,
    }),
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

  const streetAddress = event.locationAddress || event.locationName;

  return compactJsonLdObject({
    '@type': 'Place',
    name: event.locationName,
    address: streetAddress
      ? compactJsonLdObject({
          '@type': 'PostalAddress',
          streetAddress,
          addressLocality: 'Hong Kong',
          addressCountry: 'HK',
        })
      : undefined,
  });
}

function resolveEventOffer(
  event: EventCardData,
  locale: Locale,
): JsonLdObject | undefined {
  const organizationSchemaId = getOrganizationSchemaId();
  if (!event.ctaHref) {
    return undefined;
  }

  const offerPrice =
    event.price !== undefined && Number.isFinite(event.price)
      ? String(event.price)
      : undefined;
  const offerCurrency =
    offerPrice !== undefined ? (event.currency || 'HKD') : undefined;
  const validFrom =
    event.timestamp !== null
      ? new Date(event.timestamp).toISOString()
      : undefined;

  return compactJsonLdObject({
    '@type': 'Offer',
    url: toAbsoluteUrl(event.ctaHref),
    price: offerPrice,
    priceCurrency: offerCurrency,
    availability: event.status === 'fully_booked'
      ? OFFER_AVAILABILITY_SOLD_OUT
      : OFFER_AVAILABILITY_IN_STOCK,
    validFrom,
    category: 'Course',
    seller: {
      '@id': organizationSchemaId,
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
  const organizationSchemaId = getOrganizationSchemaId();
  const fallbackImage = toAbsoluteUrl('/images/evolvesprouts-logo.svg');
  return events
    .filter((event) => event.timestamp !== null)
    .map((event) => {
      const endDate =
        event.endTimestamp != null && Number.isFinite(event.endTimestamp)
          ? new Date(event.endTimestamp).toISOString()
          : undefined;

      return compactJsonLdObject({
        '@context': SCHEMA_CONTEXT,
        '@type': 'Event',
        '@id': buildEventSchemaId(locale, event.id),
        name: event.title,
        description: event.summary,
        startDate:
          event.timestamp === null ? undefined : new Date(event.timestamp).toISOString(),
        endDate,
        image: fallbackImage,
        eventStatus: EVENT_STATUS_SCHEDULED,
        eventAttendanceMode: resolveEventAttendanceMode(event),
        location: resolveEventLocation(event, locale),
        organizer: {
          '@id': organizationSchemaId,
        },
        performer: {
          '@id': organizationSchemaId,
        },
        offers: resolveEventOffer(event, locale),
      });
    })
    .filter((entry) => Object.keys(entry).length > 0);
}
