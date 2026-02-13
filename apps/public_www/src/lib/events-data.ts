import type { EventsContent } from '@/content';
import {
  readCandidateText,
  readOptionalText,
} from '@/content/content-field-utils';
import { isHttpHref } from '@/lib/url-utils';

export interface SortOption {
  value: string;
  label: string;
}

type EventStatus = 'open' | 'fully_booked';

export interface EventCardData {
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

const DEFAULT_SORT_OPTIONS: readonly SortOption[] = [
  { value: 'latest', label: 'Latest Events' },
  { value: 'oldest', label: 'Older Events' },
  { value: 'fully_booked', label: 'Fully Booked' },
];

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function sanitizeExternalHref(value: string | undefined): string {
  const href = readOptionalText(value);
  if (!href || !isHttpHref(href)) {
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

export function resolveSortOptions(content: EventsContent): readonly SortOption[] {
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

export async function fetchEventsPayload(
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

export function resolveRuntimeEventsApiUrl(configuredApiUrl: string): string {
  if (typeof window === 'undefined') {
    return configuredApiUrl;
  }

  try {
    const resolvedUrl = new URL(configuredApiUrl, window.location.origin);
    const isConfiguredAsAbsolute = /^https?:\/\//i.test(configuredApiUrl);
    if (!isConfiguredAsAbsolute) {
      return `${resolvedUrl.pathname}${resolvedUrl.search}`;
    }

    const isWebsiteHost = window.location.hostname.endsWith('evolvesprouts.com');
    const isPrimaryApiHost = resolvedUrl.hostname === 'api.evolvesprouts.com';

    if (isWebsiteHost && isPrimaryApiHost) {
      return `/api${resolvedUrl.pathname}${resolvedUrl.search}`;
    }
  } catch {
    return configuredApiUrl;
  }

  return configuredApiUrl;
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

export function normalizeEvents(
  payload: unknown,
  content: EventsContent,
): EventCardData[] {
  const eventsArray = findEventsArray(payload);

  return eventsArray
    .map((item, index) => normalizeEventCard(item, index, content))
    .filter((item): item is EventCardData => item !== null);
}

export function sortEvents(
  events: EventCardData[],
  activeFilter: string,
): EventCardData[] {
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
