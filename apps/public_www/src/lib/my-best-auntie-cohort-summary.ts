import type { Locale } from '@/content';
import type { MyBestAuntieEventCohort } from '@/lib/events-data';
import {
  formatYmdInPublicSiteTimeZone,
  getPrimarySessionSortValue,
  isFutureCohort,
} from '@/lib/my-best-auntie-cohort-calendar';
import { formatCohortValue } from '@/lib/format';

export interface MyBestAuntieHeroCohortSummary {
  lowestPrice: number | undefined;
  priceCurrency: string | undefined;
  nextCohortLabel: string | undefined;
}

/**
 * Derives hero quick-fact inputs from CRM calendar cohorts (same source as booking).
 * `nextCohortLabel` is a locale-formatted display string from the cohort token (e.g. apr-26).
 */
export function resolveMyBestAuntieHeroCohortSummary(
  cohorts: MyBestAuntieEventCohort[] | undefined,
  locale: Locale,
): MyBestAuntieHeroCohortSummary {
  if (!cohorts || cohorts.length === 0) {
    return {
      lowestPrice: undefined,
      priceCurrency: undefined,
      nextCohortLabel: undefined,
    };
  }
  const notSoldOut = cohorts.filter((c) => !c.is_fully_booked);
  const todayYmd = formatYmdInPublicSiteTimeZone(new Date());
  const available = notSoldOut.filter((c) => isFutureCohort(c, todayYmd));
  if (available.length === 0) {
    return {
      lowestPrice: undefined,
      priceCurrency: undefined,
      nextCohortLabel: undefined,
    };
  }

  let lowestPrice = Infinity;
  let priceCurrency: string | undefined;
  for (const c of available) {
    if (c.price < lowestPrice) {
      lowestPrice = c.price;
      priceCurrency = c.currency?.trim() || 'HKD';
    }
  }
  const resolvedLowest =
    lowestPrice === Infinity || lowestPrice <= 0 ? undefined : lowestPrice;

  const sorted = [...available].sort((a, b) => {
    const dateDifference =
      getPrimarySessionSortValue(a) - getPrimarySessionSortValue(b);
    if (dateDifference !== 0) {
      return dateDifference;
    }
    return a.slug.localeCompare(b.slug);
  });
  const rawCohort = sorted[0]?.cohort ?? '';
  const nextCohortLabel =
    formatCohortValue(rawCohort, locale) || rawCohort || undefined;

  return {
    lowestPrice: resolvedLowest,
    priceCurrency: resolvedLowest !== undefined ? priceCurrency : undefined,
    nextCohortLabel,
  };
}
