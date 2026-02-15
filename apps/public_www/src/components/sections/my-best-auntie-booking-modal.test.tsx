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

  it('does not render course schedule heading and uses shared calendar icon in booking modal', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(screen.queryByText('Course Schedule')).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('span[style*="/images/calendar.svg"]').length,
    ).toBeGreaterThan(0);
  });

  it('does not render the month/package selector box in booking modal', () => {
    render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(
      screen.queryByRole('heading', { name: bookingModalContent.monthLabel }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: bookingModalContent.packageLabel }),
    ).not.toBeInTheDocument();

    for (const option of bookingModalContent.packageOptions) {
      expect(screen.queryByText(option.description)).not.toBeInTheDocument();
    }
  });

  it('uses cubes.svg mask icon for all course part chips', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(container.querySelectorAll('span[style*="/images/cubes.svg"]')).toHaveLength(3);
  });

  it('renders overlapping rounded timeline segments and 10px gap connectors', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    const timelineSegments = container.querySelectorAll(
      'span[data-course-part-line="segment"]',
    );
    const gapConnectors = container.querySelectorAll(
      'span[data-course-part-line="gap-connector"]',
    );
    expect(timelineSegments).toHaveLength(3);
    expect(gapConnectors).toHaveLength(3);
    expect(
      container.querySelectorAll('span[data-course-part-line="connector"]'),
    ).toHaveLength(0);

    for (const [index, segment] of Array.from(timelineSegments).entries()) {
      const style = segment.getAttribute('style');
      expect(style).toContain('width: 25px');
      expect(style).toContain('border-top-left-radius: 999px');
      expect(style).toContain('border-top-right-radius: 999px');
      expect(style).toContain(`z-index: ${index + 1}`);
      if (index > 0) {
        expect(style).toContain('top: -12px');
        expect(style).toContain('box-shadow: 0 -5px 0 0 #FFFFFF');
      }
    }

    for (const connector of gapConnectors) {
      const style = connector.getAttribute('style');
      const className = connector.getAttribute('class');
      expect(style).toContain('width: 25px');
      expect(style).toContain('height: 10px');
      expect(className).toContain('top-1/2');
      expect(className).toContain('-translate-y-1/2');
      expect(className).toContain('-left-[25px]');
    }

    const firstPartItem = screen.getByText(bookingModalContent.parts[0].label).closest('li');
    expect(firstPartItem?.getAttribute('style')).toContain('padding-left: 50px');
    expect(firstPartItem?.getAttribute('style')).toContain('padding-bottom: 100px');
    expect(firstPartItem?.querySelector('img')).toBeNull();
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

  it('renders unicode direction arrow in link and keeps matching location dividers', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    const directionLink = screen.getByRole('link', {
      name: bookingModalContent.directionLabel,
    });

    expect(directionLink).toHaveAttribute('href', bookingModalContent.directionHref);
    expect(directionLink.textContent).toContain('↗');
    expect(directionLink.textContent).toContain(bookingModalContent.directionLabel);
    expect(
      container.querySelector('img[src*="/images/my-best-auntie-booking/direction-mark.png"]'),
    ).toBeNull();
    expect(container.querySelectorAll('div.border-b.border-black\\/15')).toHaveLength(2);
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

  it('uses shared calendar icon in thank-you modal summary chip', () => {
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
      container.querySelector('span[style*="/images/calendar.svg"]'),
    ).not.toBeNull();
  });
});
