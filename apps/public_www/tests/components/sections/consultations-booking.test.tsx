import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsultationsBooking } from '@/components/sections/consultations/consultations-booking';
import enContent from '@/content/en.json';
import calendarAvailability from '@/content/calendar-availability.json';

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

    const { container } = render(
      <ConsultationsBooking
        locale='en'
        content={booking}
        bookingModalContent={enContent.bookingModal}
        calendarAvailability={calendarAvailability}
      />,
    );

    expect(screen.getByRole('heading', { name: booking.title })).toBeInTheDocument();

    const section = container.querySelector('#consultations-booking');
    expect(section?.className).toContain('es-my-best-auntie-booking-section');

    expect(
      screen.getByRole('button', { name: booking.reservation.ctaLabel }),
    ).toBeInTheDocument();

    for (const area of booking.focusAreas) {
      expect(screen.getByRole('heading', { name: area.title })).toBeInTheDocument();
      const icon = document.querySelector(`img[src="${area.iconSrc}"]`);
      expect(icon).not.toBeNull();
    }

    for (const level of booking.levels) {
      expect(screen.getByRole('button', { name: level.title })).toBeInTheDocument();
      const icon = document.querySelector(`img[src="${level.iconSrc}"]`);
      expect(icon).not.toBeNull();
    }

    const focusCarousel = screen.getByTestId('consultations-booking-focus-carousel');
    expect(focusCarousel.className).toContain('snap-mandatory');
    expect(focusCarousel.className).toContain('overflow-x-auto');
    expect(focusCarousel.getAttribute('role')).toBe('region');
    expect(focusCarousel.getAttribute('aria-roledescription')).toBe(
      enContent.common.accessibility.carouselRoleDescription,
    );

    const levelCarousel = screen.getByTestId('consultations-booking-level-carousel');
    expect(levelCarousel.className).toContain('snap-mandatory');
    expect(levelCarousel.className).toContain('overflow-x-auto');
  });
});
