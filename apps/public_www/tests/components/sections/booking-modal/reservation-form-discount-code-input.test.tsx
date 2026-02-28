import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReservationFormDiscountCodeInput } from '@/components/sections/booking-modal/reservation-form-discount-code-input';
import enContent from '@/content/en.json';

describe('ReservationFormDiscountCodeInput', () => {
  it('forwards changes and apply clicks when discount is editable', () => {
    const onDiscountCodeChange = vi.fn();
    const onApplyDiscount = vi.fn();

    render(
      <ReservationFormDiscountCodeInput
        content={enContent.myBestAuntieBooking.paymentModal}
        discountCode=''
        discountError=''
        hasDiscountRule={false}
        isDiscountValidationSubmitting={false}
        onDiscountCodeChange={onDiscountCodeChange}
        onApplyDiscount={onApplyDiscount}
      />,
    );

    const input = screen.getByLabelText(
      enContent.myBestAuntieBooking.paymentModal.discountCodeLabel,
    );
    const applyButton = screen.getByRole('button', {
      name: enContent.myBestAuntieBooking.paymentModal.applyDiscountLabel,
    });

    fireEvent.change(input, { target: { value: 'SPRING10' } });
    fireEvent.click(applyButton);

    expect(onDiscountCodeChange).toHaveBeenCalledWith('SPRING10');
    expect(onApplyDiscount).toHaveBeenCalledTimes(1);
  });

  it('disables input controls and shows validation error', () => {
    render(
      <ReservationFormDiscountCodeInput
        content={enContent.myBestAuntieBooking.paymentModal}
        discountCode='SPRING10'
        discountError='Invalid discount code'
        hasDiscountRule
        isDiscountValidationSubmitting={false}
        onDiscountCodeChange={vi.fn()}
        onApplyDiscount={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(
      enContent.myBestAuntieBooking.paymentModal.discountCodeLabel,
    );
    const applyButton = screen.getByRole('button', {
      name: enContent.myBestAuntieBooking.paymentModal.applyDiscountLabel,
    });

    expect(input).toBeDisabled();
    expect(applyButton).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid discount code');
  });
});
