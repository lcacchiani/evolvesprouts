import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReservationFormPriceBreakdown } from '@/components/sections/booking-modal/reservation-form-price-breakdown';
import enContent from '@/content/en.json';
import zhCNContent from '@/content/zh-CN.json';

describe('ReservationFormPriceBreakdown', () => {
  it('renders only base price row when there is no discount', () => {
    render(
      <ReservationFormPriceBreakdown
        content={enContent.myBestAuntieBooking.paymentModal}
        locale='en'
        originalAmount={9000}
        discountAmount={0}
        totalAmount={9000}
      />,
    );

    expect(
      screen.getByText(
        enContent.myBestAuntieBooking.paymentModal.priceBreakdownPriceLabel,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        enContent.myBestAuntieBooking.paymentModal.priceBreakdownDiscountLabel,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        enContent.myBestAuntieBooking.paymentModal.priceBreakdownConfirmedPriceLabel,
      ),
    ).not.toBeInTheDocument();
  });

  it('renders localized discount and confirmed price labels', () => {
    render(
      <ReservationFormPriceBreakdown
        content={zhCNContent.myBestAuntieBooking.paymentModal}
        locale='zh-CN'
        originalAmount={9000}
        discountAmount={1000}
        totalAmount={8000}
      />,
    );

    expect(
      screen.getByText(
        zhCNContent.myBestAuntieBooking.paymentModal.priceBreakdownPriceLabel,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        zhCNContent.myBestAuntieBooking.paymentModal.priceBreakdownDiscountLabel,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        zhCNContent.myBestAuntieBooking.paymentModal.priceBreakdownConfirmedPriceLabel,
      ),
    ).toBeInTheDocument();
  });
});
