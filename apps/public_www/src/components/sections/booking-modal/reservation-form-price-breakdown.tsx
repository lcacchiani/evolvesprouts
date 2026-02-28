import { formatCurrencyHkd } from '@/lib/format';
import type { Locale, MyBestAuntieBookingContent } from '@/content';

interface ReservationFormPriceBreakdownProps {
  content: MyBestAuntieBookingContent['paymentModal'];
  locale: Locale;
  originalAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export function ReservationFormPriceBreakdown({
  content,
  locale,
  originalAmount,
  discountAmount,
  totalAmount,
}: ReservationFormPriceBreakdownProps) {
  const hasDiscount = discountAmount > 0;
  const hasConfirmedPriceDifference = totalAmount !== originalAmount;

  return (
    <div data-booking-price-breakdown='true' className='my-3 space-y-2 py-1'>
      <div className='flex items-center justify-between text-sm font-semibold es-text-body'>
        <span>{content.priceBreakdownPriceLabel}</span>
        <span className='font-bold es-text-heading'>{formatCurrencyHkd(originalAmount, locale)}</span>
      </div>
      {hasDiscount ? (
        <div className='flex items-center justify-between text-sm font-semibold es-text-success'>
          <span>{content.priceBreakdownDiscountLabel}</span>
          <span>-{formatCurrencyHkd(discountAmount, locale)}</span>
        </div>
      ) : null}
      {hasConfirmedPriceDifference ? (
        <div className='flex items-center justify-between border-t es-border-divider pt-2 text-sm font-bold es-text-heading'>
          <span>{content.priceBreakdownConfirmedPriceLabel}</span>
          <span>{formatCurrencyHkd(totalAmount, locale)}</span>
        </div>
      ) : null}
    </div>
  );
}
