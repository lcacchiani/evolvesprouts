import analyticsTaxonomy from '@/lib/analytics-taxonomy.json';

export const ANALYTICS_TAXONOMY = analyticsTaxonomy;

export type AnalyticsEventName = keyof typeof ANALYTICS_TAXONOMY.events;

export function getAllowedCustomParamsForEvent(
  eventName: AnalyticsEventName,
): readonly string[] {
  return ANALYTICS_TAXONOMY.events[eventName].allowedCustomParams;
}

export function getRequiredCustomParamsForEvent(
  eventName: AnalyticsEventName,
): readonly string[] {
  return ANALYTICS_TAXONOMY.events[eventName].requiredCustomParams;
}
