/** Matches admin API `parse_create_discount_code_payload` max_length for `code`. */
export const MAX_DISCOUNT_CODE_LENGTH = 50;

const TRAILING_COPY_RE = /^(.+)(COPY(\d+)?)$/;

/**
 * After a duplicate-code (409) response, derive the next candidate: append `COPY`,
 * then `COPY2`, `COPY3`, … Trims the leading portion so the result fits the API max length.
 */
export function bumpDuplicateDiscountCode(current: string): string {
  const u = current.trim().toUpperCase();
  const match = u.match(TRAILING_COPY_RE);
  if (!match) {
    const suffix = 'COPY';
    const maxRoot = MAX_DISCOUNT_CODE_LENGTH - suffix.length;
    if (maxRoot <= 0) {
      return suffix.slice(0, MAX_DISCOUNT_CODE_LENGTH);
    }
    return `${u.slice(0, maxRoot)}${suffix}`;
  }
  const root = match[1];
  const digitPart = match[3];
  const n = digitPart ? Number.parseInt(digitPart, 10) : 1;
  const nextN = n + 1;
  const suffix = `COPY${nextN}`;
  const maxRoot = MAX_DISCOUNT_CODE_LENGTH - suffix.length;
  if (maxRoot <= 0) {
    return suffix.slice(0, MAX_DISCOUNT_CODE_LENGTH);
  }
  return `${root.slice(0, maxRoot)}${suffix}`;
}
