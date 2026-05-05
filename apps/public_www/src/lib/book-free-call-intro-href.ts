import type { Locale } from '@/content';

const BOOK_FREE_CALL_SLUG = 'book-a-free-call';
const INTRO_BOOKING_HASH = '#intro-call-booking';

/** Stable same-site href for navbar / CTAs that target the intro-call booking anchor. */
export function buildBookAFreeCallIntroAnchorHref(locale: Locale): string {
  return `/${locale}/${BOOK_FREE_CALL_SLUG}${INTRO_BOOKING_HASH}`;
}

export function isBookAFreeCallIntroBookingHref(href: string): boolean {
  return href.includes(INTRO_BOOKING_HASH);
}
