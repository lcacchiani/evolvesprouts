import type { DiscountCode } from '@/types/services';

export function formatDiscountRowValue(
  row: Pick<DiscountCode, 'discountType' | 'discountValue' | 'currency'>,
): string {
  if (row.discountType === 'referral') {
    return 'Referral';
  }
  if (row.discountType === 'percentage') {
    return `${row.discountValue}%`;
  }
  return `${row.discountValue} ${row.currency ?? ''}`.trim();
}
