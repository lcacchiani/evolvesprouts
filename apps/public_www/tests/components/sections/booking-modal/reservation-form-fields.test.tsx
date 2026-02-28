import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReservationFormFields } from '@/components/sections/booking-modal/reservation-form-fields';
import enContent from '@/content/en.json';

describe('ReservationFormFields', () => {
  it('renders validation state and wires field callbacks', () => {
    const onFullNameChange = vi.fn();
    const onEmailChange = vi.fn();
    const onEmailBlur = vi.fn();
    const onPhoneChange = vi.fn();
    const onTopicsChange = vi.fn();

    render(
      <ReservationFormFields
        content={enContent.myBestAuntieBooking.paymentModal}
        fullName='Ada'
        email='bad-email'
        phone='12345678'
        interestedTopics='Boundaries'
        hasEmailError
        onFullNameChange={onFullNameChange}
        onEmailChange={onEmailChange}
        onEmailBlur={onEmailBlur}
        onPhoneChange={onPhoneChange}
        onTopicsChange={onTopicsChange}
      />,
    );

    const nameInput = screen.getByLabelText(/Full Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    const phoneInput = screen.getByLabelText(/Phone Number/i);
    const topicsInput = screen.getByLabelText(/Any topics you are particularly interested in\?/i);

    fireEvent.change(nameInput, { target: { value: 'Grace' } });
    fireEvent.change(emailInput, { target: { value: 'grace@example.com' } });
    fireEvent.blur(emailInput);
    fireEvent.change(phoneInput, { target: { value: '87654321' } });
    fireEvent.change(topicsInput, { target: { value: 'Routines' } });

    expect(onFullNameChange).toHaveBeenCalledWith('Grace');
    expect(onEmailChange).toHaveBeenCalledWith('grace@example.com');
    expect(onEmailBlur).toHaveBeenCalledTimes(1);
    expect(onPhoneChange).toHaveBeenCalledWith('87654321');
    expect(onTopicsChange).toHaveBeenCalledWith('Routines');
    expect(
      screen.getByText(enContent.myBestAuntieBooking.paymentModal.emailValidationError),
    ).toBeInTheDocument();
  });
});
