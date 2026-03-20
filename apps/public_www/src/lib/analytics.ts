import type { AnalyticsEventName } from '@/lib/analytics-taxonomy';

type AnalyticsPrimitive = string | number | boolean;

interface TrackAnalyticsEventOptions {
  sectionId?: string;
  ctaLocation?: string;
  params?: Record<string, AnalyticsPrimitive | null | undefined>;
}

interface DataLayerEventPayload {
  event: string;
  page_path: string;
  page_title: string;
  page_locale: string;
  section_id: string;
  cta_location: string;
  environment: string;
  [key: string]: unknown;
}

const DEFAULT_SECTION_ID = 'unknown';
const DEFAULT_CTA_LOCATION = 'n/a';
const DEFAULT_LOCALE = 'en';

declare global {
  interface Window {
    dataLayer?: DataLayerEventPayload[];
  }
}

function isClientRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function resolveConfiguredSiteHost(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() ?? '';
  if (!configuredOrigin) {
    return '';
  }

  try {
    return new URL(configuredOrigin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function resolveEnvironment(): string {
  if (!isClientRuntime()) {
    return 'prod';
  }

  const currentHost = window.location.hostname.toLowerCase();
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'staging';
  }

  const configuredHost = resolveConfiguredSiteHost();
  if (!configuredHost) {
    if (currentHost.includes('staging') || currentHost.includes('preview')) {
      return 'staging';
    }
    return 'prod';
  }

  return currentHost === configuredHost ? 'prod' : 'staging';
}

function resolvePageLocale(): string {
  if (!isClientRuntime()) {
    return DEFAULT_LOCALE;
  }

  const locale = document.documentElement.lang.trim();
  return locale || DEFAULT_LOCALE;
}

function normalizeOptionalString(value: string | undefined, fallback: string): string {
  const normalized = (value ?? '').trim();
  return normalized || fallback;
}

function removeUndefinedParams(
  params: Record<string, AnalyticsPrimitive | null | undefined> | undefined,
): Record<string, AnalyticsPrimitive> {
  if (!params) {
    return {};
  }

  return Object.entries(params).reduce<Record<string, AnalyticsPrimitive>>((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  options: TrackAnalyticsEventOptions = {},
): void {
  if (!isClientRuntime()) {
    return;
  }

  const normalizedEventName = eventName.trim();
  if (!normalizedEventName) {
    return;
  }

  const payload: DataLayerEventPayload = {
    event: normalizedEventName,
    page_path: window.location.pathname,
    page_title: document.title,
    page_locale: resolvePageLocale(),
    section_id: normalizeOptionalString(options.sectionId, DEFAULT_SECTION_ID),
    cta_location: normalizeOptionalString(options.ctaLocation, DEFAULT_CTA_LOCATION),
    environment: resolveEnvironment(),
    ...removeUndefinedParams(options.params),
  };

  const existingLayer = window.dataLayer;
  if (Array.isArray(existingLayer)) {
    existingLayer.push(payload);
    return;
  }

  window.dataLayer = [payload];
}

interface EcommerceItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  price: number;
  quantity: number;
}

interface EcommerceEventPayload {
  event: string;
  ecommerce: {
    currency: string;
    value: number;
    payment_type?: string;
    transaction_id?: string;
    items: EcommerceItem[];
  };
}

export function trackEcommerceEvent(
  eventName: 'begin_checkout' | 'add_payment_info' | 'purchase',
  options: {
    value: number;
    currency?: string;
    paymentType?: string;
    transactionId?: string;
    items: EcommerceItem[];
  },
): void {
  if (!isClientRuntime()) {
    return;
  }

  const payload: EcommerceEventPayload = {
    event: eventName,
    ecommerce: {
      currency: options.currency ?? 'HKD',
      value: options.value,
      items: options.items,
    },
  };

  if (options.paymentType) {
    payload.ecommerce.payment_type = options.paymentType;
  }
  if (options.transactionId) {
    payload.ecommerce.transaction_id = options.transactionId;
  }

  const existingLayer = window.dataLayer;
  if (Array.isArray(existingLayer)) {
    existingLayer.push({ ecommerce: null } as unknown as DataLayerEventPayload);
    existingLayer.push(payload as unknown as DataLayerEventPayload);
    return;
  }

  window.dataLayer = [payload as unknown as DataLayerEventPayload];
}
