import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsultationBookingModal } from '@/components/sections/consultations/consultation-booking-modal';
import type { ConsultationBookingPickerContent } from '@/components/sections/consultations/consultation-booking-modal';
import enContent from '@/content/en.json';
import { buildConsultationsBookingModalPayload } from '@/lib/consultations-booking-modal-payload';

vi.mock('@/lib/hooks/use-modal-lock-body', () => ({
  useModalLockBody: () => {},
}));

vi.mock('@/lib/hooks/use-modal-focus-management', () => ({
  useModalFocusManagement: () => {},
}));

function buildPickerContent(
  paymentModal: typeof enContent.bookingModal.paymentModal,
): ConsultationBookingPickerContent {
  const p = paymentModal.consultationPicker;
  return {
    pickDateTimeIntro: p.pickDateTimeIntro,
    amLabel: p.amLabel,
    pmLabel: p.pmLabel,
    monthJoiner: p.monthJoiner,
    weekdayShortLabels: [
      p.weekdayShortMon,
      p.weekdayShortTue,
      p.weekdayShortWed,
      p.weekdayShortThu,
      p.weekdayShortFri,
    ],
    datePickerLegend: p.datePickerLegend,
    datePickerDayTemplate: p.datePickerDayTemplate,
    datePickerUnavailableDayTemplate: p.datePickerUnavailableDayTemplate,
  };
}

describe('ConsultationBookingModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-04-07T12:00:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows pick intro, calendar icon, and selected slot summary for the default day', () => {
    const bookingPayload = buildConsultationsBookingModalPayload(
      enContent.consultations.booking.reservation,
      'en',
      { focusLabel: 'Home', levelLabel: 'Essentials' },
    );

    render(
      <ConsultationBookingModal
        locale='en'
        paymentModalContent={enContent.bookingModal.paymentModal}
        bookingPayload={bookingPayload}
        pickerContent={buildPickerContent(enContent.bookingModal.paymentModal)}
        calendarAvailability={{ unavailable_slots: [] }}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(
      screen.getByText(enContent.bookingModal.paymentModal.consultationPicker.pickDateTimeIntro),
    ).toBeInTheDocument();

    expect(screen.getByTestId('consultation-modal-selected-slot')).toBeInTheDocument();
    const icon = screen.getByTestId('consultation-modal-selected-slot-calendar-icon');
    expect(icon.className).toContain('es-mask-calendar-danger');
  });

  it('selects PM when only the afternoon slot is available for that day', () => {
    const bookingPayload = buildConsultationsBookingModalPayload(
      enContent.consultations.booking.reservation,
      'en',
      { focusLabel: 'Home', levelLabel: 'Essentials' },
    );

    render(
      <ConsultationBookingModal
        locale='en'
        paymentModalContent={enContent.bookingModal.paymentModal}
        bookingPayload={bookingPayload}
        pickerContent={buildPickerContent(enContent.bookingModal.paymentModal)}
        calendarAvailability={{
          unavailable_slots: [{ date: '2026-04-09', period: 'am' }],
        }}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    const day9 = screen.getByRole('button', { name: 'Select day 9' });
    fireEvent.click(day9);

    const pmButton = screen.getByRole('button', { name: enContent.bookingModal.paymentModal.consultationPicker.pmLabel });
    const amButton = screen.getByRole('button', { name: enContent.bookingModal.paymentModal.consultationPicker.amLabel });

    expect(pmButton).toHaveAttribute('aria-pressed', 'true');
    expect(amButton).toBeDisabled();
  });
});
