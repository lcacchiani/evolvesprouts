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
