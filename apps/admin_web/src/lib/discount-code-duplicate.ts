/** Matches admin API `parse_create_discount_code_payload` max_length for `code`. */
export const MAX_DISCOUNT_CODE_LENGTH = 50;

const COPY_SUFFIX = 'COPY';

/**
 * When create fails with duplicate code, append `COPY` (trimming the base if needed
 * so the result fits `MAX_DISCOUNT_CODE_LENGTH`).
 */
export function buildDuplicateDiscountCodeName(base: string): string {
  const normalized = base.trim().toUpperCase();
  if (!normalized) {
    return COPY_SUFFIX;
  }
  const suffixLen = COPY_SUFFIX.length;
  if (normalized.length + suffixLen <= MAX_DISCOUNT_CODE_LENGTH) {
    return `${normalized}${COPY_SUFFIX}`;
  }
  const keep = MAX_DISCOUNT_CODE_LENGTH - suffixLen;
  return `${normalized.slice(0, keep)}${COPY_SUFFIX}`;
}
