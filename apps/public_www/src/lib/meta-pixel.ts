import type { LandingPageSlug } from '@/lib/landing-pages';
import type { MetaPixelStaticContentName } from '@/lib/meta-pixel-taxonomy';

export type MetaPixelStandardEvent =
  | 'Lead'
  | 'Schedule'
  | 'Contact'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase'
  | 'CompleteRegistration'
  | 'ViewContent';

export type MetaPixelContentName = MetaPixelStaticContentName | LandingPageSlug;

type MetaPixelParamValue = string | number | boolean;

export interface MetaPixelEventParams {
  content_name?: MetaPixelContentName;
  content_category?: string;
  value?: number;
  currency?: string;
  [key: string]: MetaPixelParamValue | undefined;
}

type FbqFunction = (
  action: 'track',
  event: MetaPixelStandardEvent,
  params?: Record<string, MetaPixelParamValue>,
) => void;

declare global {
  interface Window {
    fbq?: FbqFunction;
  }
}

function isClientRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

export function trackMetaPixelEvent(
  event: MetaPixelStandardEvent,
  params?: MetaPixelEventParams,
): void {
  if (!isClientRuntime()) {
    return;
  }

  if (params) {
    window.fbq!('track', event, params as Record<string, MetaPixelParamValue>);
  } else {
    window.fbq!('track', event);
  }
}
