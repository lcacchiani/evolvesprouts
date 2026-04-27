/** URL-safe instance slug: lowercase segments of alphanumerics separated by single hyphens. */
export const INSTANCE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const _MAX_INSTANCE_SLUG_LEN = 128;

/**
 * Normalize free text to the same rules as the DB backfill slugify (migration 0043):
 * lowercase, non-alphanumeric runs to a single hyphen, trim hyphens, cap length.
 */
export function slugifyForInstance(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const withHyphens = lower.replace(/[^a-z0-9]+/g, '-');
  const trimmed = withHyphens.replace(/^-+|-+$/g, '');
  if (trimmed.length <= _MAX_INSTANCE_SLUG_LEN) {
    return trimmed.replace(/-+$/, '');
  }
  return trimmed.slice(0, _MAX_INSTANCE_SLUG_LEN).replace(/-+$/, '');
}

export interface SuggestedInstanceSlugSlot {
  sortOrder: number | null;
  startsAtLocal: string | null;
}

function _todayYmdUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _firstSessionSlotYmd(slots: SuggestedInstanceSlugSlot[]): string | null {
  if (!slots.length) {
    return null;
  }
  const sorted = [...slots].sort((a, b) => {
    const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (so !== 0) {
      return so;
    }
    return String(a.startsAtLocal ?? '').localeCompare(String(b.startsAtLocal ?? ''));
  });
  const first = sorted[0]?.startsAtLocal?.trim();
  if (!first) {
    return null;
  }
  const ymd = first.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** Suggested public instance slug for create flows (event / training_course). */
export function computeSuggestedInstanceSlug(
  serviceType: 'event' | 'training_course' | 'consultation',
  service: { title: string; slug: string | null | undefined; serviceTier: string | null | undefined } | null,
  instanceForm: { title: string; cohort: string; sessionSlots: SuggestedInstanceSlugSlot[] }
): string {
  if (serviceType === 'event') {
    const titlePart = slugifyForInstance(instanceForm.title || '');
    const datePart = _firstSessionSlotYmd(instanceForm.sessionSlots) ?? _todayYmdUtc();
    if (!titlePart) {
      return datePart;
    }
    return `${titlePart}-${datePart}`;
  }
  if (serviceType === 'training_course') {
    if (!service) {
      return slugifyForInstance(instanceForm.cohort.trim() || instanceForm.title);
    }
    const slugLower = (service.slug ?? '').trim().toLowerCase();
    const tier = (service.serviceTier ?? '').trim();
    const cohortRaw = instanceForm.cohort.trim() || instanceForm.title;
    const cohortPart = slugifyForInstance(cohortRaw);
    if (slugLower === 'my-best-auntie' && tier && cohortPart) {
      return slugifyForInstance(`my-best-auntie-${tier}-${cohortRaw}`);
    }
    const base = slugifyForInstance((service.slug ?? '').trim() || service.title || '');
    if (!cohortPart) {
      return base;
    }
    if (!base) {
      return cohortPart;
    }
    return `${base}-${cohortPart}`;
  }
  return '';
}
