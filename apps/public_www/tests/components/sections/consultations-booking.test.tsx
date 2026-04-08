import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConsultationsBooking } from '@/components/sections/consultations/consultations-booking';
import enContent from '@/content/en.json';
import calendarAvailability from '@/content/calendar-availability.json';
import { formatContentTemplate } from '@/content/content-field-utils';

vi.mock('next/dynamic', () => ({
  default: () => {
    function MockDynamic() {
      return null;
    }
    return MockDynamic;
  },
}));

const MD_UP_MEDIA_QUERY = '(min-width: 768px)';
const originalMatchMedia = window.matchMedia;

function mockViewportMdUp(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === MD_UP_MEDIA_QUERY ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    return;
  }

  Reflect.deleteProperty(window, 'matchMedia');
});

describe('ConsultationsBooking', () => {
  it('renders focus area cards with SVG icons from content', () => {
    mockViewportMdUp(true);
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

    const focusGrid = screen.getByTestId('consultations-booking-focus-grid');
    for (const area of booking.focusAreas) {
      expect(
        within(focusGrid).getByRole('heading', { name: area.title }),
      ).toBeInTheDocument();
      expect(
        document.querySelectorAll(`img[src="${area.iconSrc}"]`).length,
      ).toBeGreaterThanOrEqual(1);
    }

    const levelGrid = screen.getByTestId('consultations-booking-level-grid');
    const levelSelectorList = levelGrid.querySelector(':scope > ul');
    expect(levelSelectorList).not.toBeNull();
    for (const level of booking.levels) {
      expect(
        within(levelGrid).getByRole('button', { name: level.title }),
      ).toBeInTheDocument();
      expect(
        document.querySelectorAll(`img[src="${level.iconSrc}"]`).length,
      ).toBeGreaterThanOrEqual(1);
    }

    const levelDescription = screen.getByTestId(
      'consultations-booking-level-description',
    );
    const essentials = booking.levels[0];
    expect(essentials).toBeDefined();
    expect(
      within(levelDescription).getByRole('heading', { name: essentials!.title }),
    ).toBeInTheDocument();
    for (const feature of essentials!.features) {
      expect(within(levelDescription).getByText(feature)).toBeInTheDocument();
    }
    expect(
      within(levelDescription).getByText(essentials!.bestFor),
    ).toBeInTheDocument();

    const deepDive = booking.levels[1];
    expect(deepDive).toBeDefined();
    fireEvent.click(within(levelGrid).getByRole('button', { name: deepDive!.title }));
    expect(
      within(levelDescription).getByRole('heading', { name: deepDive!.title }),
    ).toBeInTheDocument();
    for (const feature of deepDive!.features) {
      expect(within(levelDescription).getByText(feature)).toBeInTheDocument();
    }
    expect(
      within(levelDescription).getByText(deepDive!.bestFor),
    ).toBeInTheDocument();

    expect(focusGrid.getAttribute('role')).toBe('group');
    expect(focusGrid.getAttribute('aria-label')).toBe(booking.step1Title);
    expect(focusGrid.querySelectorAll(':scope > ul > li')).toHaveLength(
      booking.focusAreas.length,
    );

    expect(levelGrid.getAttribute('role')).toBe('group');
    expect(levelGrid.getAttribute('aria-label')).toBe(booking.step2Title);
    expect(levelSelectorList!.querySelectorAll(':scope > li')).toHaveLength(
      booking.levels.length,
    );

    expect(screen.queryByTestId('consultations-booking-focus-carousel')).toBeNull();
    expect(screen.queryByTestId('consultations-booking-level-carousel')).toBeNull();
  });

  it('uses mobile carousel tracks with smaller slides and keyboard scrolling below md', () => {
    mockViewportMdUp(false);
    const booking = enContent.consultations.booking;

    render(
      <ConsultationsBooking
        locale='en'
        content={booking}
        bookingModalContent={enContent.bookingModal}
        calendarAvailability={calendarAvailability}
      />,
    );

    const expectedFocusAriaLabel = formatContentTemplate(
      enContent.common.accessibility.carouselLabelTemplate,
      { title: booking.step1Title },
    );

    const focusCarousel = screen.getByTestId('consultations-booking-focus-carousel');
    expect(focusCarousel.className).toContain('snap-mandatory');
    expect(focusCarousel.className).toContain('overflow-x-auto');
    expect(focusCarousel.getAttribute('role')).toBe('region');
    expect(focusCarousel.getAttribute('aria-label')).toBe(expectedFocusAriaLabel);
    expect(focusCarousel.getAttribute('aria-roledescription')).toBe(
      enContent.common.accessibility.carouselRoleDescription,
    );
    const focusSlides = focusCarousel.querySelectorAll(':scope > ul > li');
    expect(focusSlides).toHaveLength(booking.focusAreas.length);
    expect(focusSlides[0]?.className).toContain('w-[77.28vw]');
    expect(focusSlides[0]?.className).toContain('max-w-[331px]');
    expect(focusSlides[0]?.className).toContain('sm:w-[62.56vw]');

    expect(screen.queryByTestId('consultations-booking-focus-grid')).toBeNull();
    expect(screen.queryByTestId('consultations-booking-level-carousel')).toBeNull();

    const levelGrid = screen.getByTestId('consultations-booking-level-grid');
    expect(levelGrid.getAttribute('role')).toBe('group');
    expect(levelGrid.getAttribute('aria-label')).toBe(booking.step2Title);
    const levelSelectorList = levelGrid.querySelector(':scope > ul');
    expect(levelSelectorList).not.toBeNull();
    expect(levelSelectorList!.className).toContain('grid-cols-2');
    expect(levelSelectorList!.querySelectorAll(':scope > li')).toHaveLength(
      booking.levels.length,
    );

    const levelDescription = screen.getByTestId(
      'consultations-booking-level-description',
    );
    const essentials = booking.levels[0];
    expect(essentials).toBeDefined();
    expect(
      within(levelDescription).getByRole('heading', { name: essentials!.title }),
    ).toBeInTheDocument();
    for (const feature of essentials!.features) {
      expect(within(levelDescription).getByText(feature)).toBeInTheDocument();
    }

    const deepDive = booking.levels[1];
    expect(deepDive).toBeDefined();

    const deepDiveButton = screen.getByRole('button', { name: 'Deep Dive' });
    fireEvent.click(deepDiveButton);
    expect(deepDiveButton.getAttribute('aria-pressed')).toBe('true');
    expect(
      within(levelDescription).getByRole('heading', { name: deepDive!.title }),
    ).toBeInTheDocument();
    for (const feature of deepDive!.features) {
      expect(within(levelDescription).getByText(feature)).toBeInTheDocument();
    }

    fireEvent.keyDown(focusCarousel, { key: 'ArrowRight' });
  });
});
