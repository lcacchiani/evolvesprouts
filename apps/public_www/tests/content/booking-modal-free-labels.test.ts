import { describe, expect, it } from 'vitest';

import enContent from '@/content/en.json';
import zhCNContent from '@/content/zh-CN.json';
import zhHKContent from '@/content/zh-HK.json';

describe('booking modal free labels (locale parity)', () => {
  it('defines priceBreakdownFreeLabel and freeTotalLabel in all locales', () => {
    expect(enContent.bookingModal.paymentModal.priceBreakdownFreeLabel).toBeTruthy();
    expect(enContent.bookingModal.thankYouModal.freeTotalLabel).toBeTruthy();
    expect(zhCNContent.bookingModal.paymentModal.priceBreakdownFreeLabel).toBeTruthy();
    expect(zhCNContent.bookingModal.thankYouModal.freeTotalLabel).toBeTruthy();
    expect(zhHKContent.bookingModal.paymentModal.priceBreakdownFreeLabel).toBeTruthy();
    expect(zhHKContent.bookingModal.thankYouModal.freeTotalLabel).toBeTruthy();
  });
});
