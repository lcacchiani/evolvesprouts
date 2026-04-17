const REF_PARAM = 'ref';
const DISCOUNT_PARAM = 'discount';

function normalizeDiscountCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

/**
 * Read a referral/discount code from a query string (`?ref=` or `?discount=`).
 * `ref` wins when both are present. Matching is case-insensitive for param names.
 */
export function readReferralCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(
    search.startsWith('?') ? search : `?${search}`,
  );
  const keys = [...params.keys()];
  const refKey = keys.find((key) => key.toLowerCase() === REF_PARAM);
  const discountKey = keys.find((key) => key.toLowerCase() === DISCOUNT_PARAM);
  const refRaw = refKey ? params.get(refKey) : null;
  const discountRaw = discountKey ? params.get(discountKey) : null;
  const chosen = refRaw ?? discountRaw;
  if (!chosen) {
    return null;
  }
  return normalizeDiscountCode(chosen);
}
