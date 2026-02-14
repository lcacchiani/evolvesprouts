/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  MyBestAuntieBookingModal,
  MyBestAuntieThankYouModal,
  type ReservationSummary,
} from '@/components/sections/my-best-auntie-booking-modal';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const bookingModalContent = enContent.myBestAuntieBooking.paymentModal;
const thankYouModalContent = enContent.myBestAuntieBooking.thankYouModal;

const reservationSummary: ReservationSummary = {
  attendeeName: 'Test User',
  attendeeEmail: 'test@example.com',
  attendeePhone: '12345678',
  childAgeGroup: '18-24 months',
  packageLabel: 'Standard Package',
  monthLabel: 'April',
  paymentMethod: 'Pay via FPS QR',
  totalAmount: 9000,
  courseLabel: 'My Best Auntie',
  scheduleDateLabel: 'April',
  scheduleTimeLabel: '12:00 pm - 2:00 pm',
};

describe('my-best-auntie booking modals footer content', () => {
  it('hides child age group and payment method in booking modal', () => {
    render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        selectedAgeGroupLabel='18-24 months'
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(
      screen.queryByText(bookingModalContent.selectedAgeGroupLabel),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('18-24 months')).not.toBeInTheDocument();
    expect(
      screen.queryByText(bookingModalContent.paymentMethodLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(bookingModalContent.paymentMethodValue),
    ).not.toBeInTheDocument();
  });

  it('does not render booking modal copyright footer section', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(screen.queryByText('2026 Evolve Sprouts')).not.toBeInTheDocument();
    expect(screen.queryByText(/©/u)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('border-b border-black/10');
  });

  it('does not render thank-you modal copyright footer section', () => {
    const { container } = render(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        homeHref='/en'
        onClose={() => {}}
      />,
    );

    expect(
      screen.queryByText(`${new Date().getFullYear()} Evolve Sprouts`),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/©/u)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('border-t border-black/10');
  });
});
