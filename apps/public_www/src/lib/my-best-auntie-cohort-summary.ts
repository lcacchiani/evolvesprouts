import type { Locale } from '@/content';
import type { MyBestAuntieEventCohort } from '@/lib/events-data';
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
  const available = cohorts.filter((c) => !c.is_fully_booked);
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
    const dateA = a.dates[0]?.start_datetime ?? '';
    const dateB = b.dates[0]?.start_datetime ?? '';
    return dateA.localeCompare(dateB);
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

/** Display symbol for hero/outline copy; JSON-LD keeps ISO codes (e.g. HKD). */
export function formatTrainingCoursePriceCurrencySymbol(iso: string): string {
  const code = iso.trim().toUpperCase();
  if (code === 'HKD') {
    return 'HK$';
  }
  try {
    const symbol = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;
    if (symbol && symbol.trim()) {
      return symbol;
    }
  } catch {
    // fall through
  }
  return `${code} `;
}
