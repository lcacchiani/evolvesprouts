type MetaPixelStandardEvent =
  | 'Lead'
  | 'Schedule'
  | 'Contact'
  | 'InitiateCheckout'
  | 'ViewContent';

type MetaPixelParamValue = string | number | boolean;

interface MetaPixelEventParams {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
  [key: string]: MetaPixelParamValue | undefined;
}

type FbqFunction = (
  action: 'track',
  event: MetaPixelStandardEvent,
  params?: MetaPixelEventParams,
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
    window.fbq!('track', event, params);
  } else {
    window.fbq!('track', event);
  }
}
