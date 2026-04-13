import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsultationBookingModal } from '@/components/sections/consultations/consultation-booking-modal';
import type {
  ConsultationBookingPickerContent,
  ConsultationBookingModalSelectionInfo,
} from '@/components/sections/consultations/consultation-booking-modal';
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

  it('shows focus label and level features when selectionInfo is provided', () => {
    const essentialsLevel = enContent.consultations.booking.levels[0];
    const selectionInfo: ConsultationBookingModalSelectionInfo = {
      focusLabel: 'Home Assessment',
      levelId: 'essentials',
      levelFeatures: essentialsLevel.features,
      focusLabelFormatted: 'Home Assessment focus',
      upgradeToDeepDiveLabel: enContent.consultations.booking.reservation.upgradeToDeepDiveLabel,
    };

    const bookingPayload = buildConsultationsBookingModalPayload(
      enContent.consultations.booking.reservation,
      'en',
    );

    render(
      <ConsultationBookingModal
        locale='en'
        paymentModalContent={enContent.bookingModal.paymentModal}
        bookingPayload={bookingPayload}
        pickerContent={buildPickerContent(enContent.bookingModal.paymentModal)}
        calendarAvailability={{ unavailable_slots: [] }}
        selectionInfo={selectionInfo}
        onClose={() => {}}
        onSubmitReservation={() => {}}
        onUpgradeToDeepDive={() => {}}
      />,
    );

    expect(screen.getByText('Home Assessment focus')).toBeInTheDocument();
    for (const feature of essentialsLevel.features) {
      expect(screen.getByText(feature)).toBeInTheDocument();
    }
  });

  it('shows upgrade button for essentials and hides for deep-dive', () => {
    const upgradeLabel = enContent.consultations.booking.reservation.upgradeToDeepDiveLabel;
    const essentialsInfo: ConsultationBookingModalSelectionInfo = {
      focusLabel: 'Home Assessment',
      levelId: 'essentials',
      levelFeatures: enContent.consultations.booking.levels[0].features,
      focusLabelFormatted: 'Home Assessment focus',
      upgradeToDeepDiveLabel: upgradeLabel,
    };

    const bookingPayload = buildConsultationsBookingModalPayload(
      enContent.consultations.booking.reservation,
      'en',
    );

    const { unmount } = render(
      <ConsultationBookingModal
        locale='en'
        paymentModalContent={enContent.bookingModal.paymentModal}
        bookingPayload={bookingPayload}
        pickerContent={buildPickerContent(enContent.bookingModal.paymentModal)}
        calendarAvailability={{ unavailable_slots: [] }}
        selectionInfo={essentialsInfo}
        onClose={() => {}}
        onSubmitReservation={() => {}}
        onUpgradeToDeepDive={() => {}}
      />,
    );

    const upgradeButton = screen.getByRole('button', { name: upgradeLabel });
    expect(upgradeButton).toBeInTheDocument();
    expect(upgradeButton).toHaveClass('es-btn--primary', 'es-btn--outline', 'max-w-[360px]');
    unmount();

    const deepDiveInfo: ConsultationBookingModalSelectionInfo = {
      focusLabel: 'Home Assessment',
      levelId: 'deep-dive',
      levelFeatures: enContent.consultations.booking.levels[1].features,
      focusLabelFormatted: 'Home Assessment focus',
      upgradeToDeepDiveLabel: upgradeLabel,
    };

    const deepDiveReservation = {
      ...enContent.consultations.booking.reservation,
      bookingTier: 'deepDive' as const,
    };

    const deepDivePayload = buildConsultationsBookingModalPayload(
      deepDiveReservation,
      'en',
    );

    render(
      <ConsultationBookingModal
        locale='en'
        paymentModalContent={enContent.bookingModal.paymentModal}
        bookingPayload={deepDivePayload}
        pickerContent={buildPickerContent(enContent.bookingModal.paymentModal)}
        calendarAvailability={{ unavailable_slots: [] }}
        selectionInfo={deepDiveInfo}
        onClose={() => {}}
        onSubmitReservation={() => {}}
        onUpgradeToDeepDive={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: upgradeLabel })).not.toBeInTheDocument();
  });

  it('calls onUpgradeToDeepDive when upgrade button is clicked', () => {
    const onUpgrade = vi.fn();
    const upgradeLabel = enContent.consultations.booking.reservation.upgradeToDeepDiveLabel;
    const selectionInfo: ConsultationBookingModalSelectionInfo = {
      focusLabel: 'Home Assessment',
      levelId: 'essentials',
      levelFeatures: enContent.consultations.booking.levels[0].features,
      focusLabelFormatted: 'Home Assessment focus',
      upgradeToDeepDiveLabel: upgradeLabel,
    };

    const bookingPayload = buildConsultationsBookingModalPayload(
      enContent.consultations.booking.reservation,
      'en',
    );

    render(
      <ConsultationBookingModal
        locale='en'
        paymentModalContent={enContent.bookingModal.paymentModal}
        bookingPayload={bookingPayload}
        pickerContent={buildPickerContent(enContent.bookingModal.paymentModal)}
        calendarAvailability={{ unavailable_slots: [] }}
        selectionInfo={selectionInfo}
        onClose={() => {}}
        onSubmitReservation={() => {}}
        onUpgradeToDeepDive={onUpgrade}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: upgradeLabel }));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });

  it('keeps PM selected when changing date if afternoon is available on the new day', () => {
    const bookingPayload = buildConsultationsBookingModalPayload(
      enContent.consultations.booking.reservation,
      'en',
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

    const pmLabel = enContent.bookingModal.paymentModal.consultationPicker.pmLabel;
    const amLabel = enContent.bookingModal.paymentModal.consultationPicker.amLabel;
    const pmButton = screen.getByRole('button', { name: pmLabel });
    fireEvent.click(pmButton);
    expect(pmButton).toHaveAttribute('aria-pressed', 'true');

    const day10 = screen.getByRole('button', { name: 'Select day 10' });
    fireEvent.click(day10);

    expect(screen.getByRole('button', { name: pmLabel })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: amLabel })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

});
