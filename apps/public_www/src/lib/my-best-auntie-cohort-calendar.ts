import type { MyBestAuntieEventCohort } from '@/lib/events-data';
import { PUBLIC_SITE_IANA_TIMEZONE } from '@/lib/site-datetime';

/** Calendar YYYY-MM-DD in {@link PUBLIC_SITE_IANA_TIMEZONE} (en-CA ordering). */
export function formatYmdInPublicSiteTimeZone(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function getPrimarySessionSortValue(cohort: MyBestAuntieEventCohort): number {
  const startDateTime = cohort.dates[0]?.start_datetime?.trim() ?? '';
  if (!startDateTime) {
    return Number.POSITIVE_INFINITY;
  }
  const parsedDate = Date.parse(startDateTime);
  if (Number.isNaN(parsedDate)) {
    return Number.POSITIVE_INFINITY;
  }
  return parsedDate;
}

/**
 * True when every session date is strictly after `todayYmd` in the public site timezone
 * (same rule as the MBA booking date strip).
 */
export function isFutureCohort(cohort: MyBestAuntieEventCohort, todayYmd: string): boolean {
  if (cohort.dates.length === 0) {
    return false;
  }

  return cohort.dates.every((datePart) => {
    const parsedDate = Date.parse(datePart.start_datetime);
    if (Number.isNaN(parsedDate)) {
      return false;
    }

    return formatYmdInPublicSiteTimeZone(new Date(parsedDate)) > todayYmd;
  });
}
