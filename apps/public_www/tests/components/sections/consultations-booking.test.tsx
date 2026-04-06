import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsultationsBooking } from '@/components/sections/consultations/consultations-booking';
import enContent from '@/content/en.json';

vi.mock('next/dynamic', () => ({
  default: () => {
    function MockDynamic() {
      return null;
    }
    return MockDynamic;
  },
}));

describe('ConsultationsBooking', () => {
  it('renders focus area cards with SVG icons from content', () => {
    const booking = enContent.consultations.booking;

    render(
      <ConsultationsBooking
        locale='en'
        content={booking}
        bookingModalContent={enContent.bookingModal}
      />,
    );

    expect(screen.getByRole('heading', { name: booking.title })).toBeInTheDocument();

    for (const area of booking.focusAreas) {
      expect(screen.getByRole('heading', { name: area.title })).toBeInTheDocument();
      const icon = document.querySelector(`img[src="${area.iconSrc}"]`);
      expect(icon).not.toBeNull();
    }
  });
});
