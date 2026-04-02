/** User-visible message when valid-until is before valid-from (single locale until admin i18n exists). */
export const DISCOUNT_VALIDITY_RANGE_INVERTED_MESSAGE =
  'Valid until must be on or after valid from.' as const;

/**
 * Compare two `datetime-local` input values (same format: YYYY-MM-DDTHH:mm).
 * Returns true when both are non-empty and `until` is strictly before `from`.
 */
export function isDiscountValidityRangeInverted(fromLocal: string, untilLocal: string): boolean {
  const from = fromLocal.trim();
  const until = untilLocal.trim();
  if (!from || !until) {
    return false;
  }
  return until < from;
}
