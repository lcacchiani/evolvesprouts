import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReservationFormPriceBreakdown } from '@/components/sections/booking-modal/reservation-form-price-breakdown';
import enContent from '@/content/en.json';
import zhCNContent from '@/content/zh-CN.json';

describe('ReservationFormPriceBreakdown', () => {
  it('renders only base price row when there is no discount', () => {
    render(
      <ReservationFormPriceBreakdown
        content={enContent.bookingModal.paymentModal}
        locale='en'
        originalAmount={9000}
        discountAmount={0}
        totalAmount={9000}
      />,
    );

    expect(
      screen.getByText(
        enContent.bookingModal.paymentModal.priceBreakdownPriceLabel,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        enContent.bookingModal.paymentModal.priceBreakdownDiscountLabel,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        enContent.bookingModal.paymentModal.priceBreakdownConfirmedPriceLabel,
      ),
    ).not.toBeInTheDocument();
  });

  it('renders localized discount and confirmed price labels', () => {
    render(
      <ReservationFormPriceBreakdown
        content={zhCNContent.bookingModal.paymentModal}
        locale='zh-CN'
        originalAmount={9000}
        discountAmount={1000}
        totalAmount={8000}
      />,
    );

    expect(
      screen.getByText(
        zhCNContent.bookingModal.paymentModal.priceBreakdownPriceLabel,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        zhCNContent.bookingModal.paymentModal.priceBreakdownDiscountLabel,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        zhCNContent.bookingModal.paymentModal.priceBreakdownConfirmedPriceLabel,
      ),
    ).toBeInTheDocument();
  });
});
