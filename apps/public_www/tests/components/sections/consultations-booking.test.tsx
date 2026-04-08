import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    for (const level of booking.levels) {
      expect(
        within(levelGrid).getByRole('button', { name: level.title }),
      ).toBeInTheDocument();
      expect(
        document.querySelectorAll(`img[src="${level.iconSrc}"]`).length,
      ).toBeGreaterThanOrEqual(1);
    }

    expect(focusGrid.getAttribute('role')).toBe('group');
    expect(focusGrid.getAttribute('aria-label')).toBe(booking.step1Title);
    expect(focusGrid.querySelectorAll(':scope > ul > li')).toHaveLength(
      booking.focusAreas.length,
    );

    expect(levelGrid.getAttribute('role')).toBe('group');
    expect(levelGrid.getAttribute('aria-label')).toBe(booking.step2Title);
    expect(levelGrid.querySelectorAll(':scope > ul > li')).toHaveLength(
      booking.levels.length,
    );

    expect(screen.queryByTestId('consultations-booking-focus-carousel')).toBeNull();
    expect(screen.queryByTestId('consultations-booking-level-carousel')).toBeNull();
  });

  it('uses mobile carousel tracks with navigation and keyboard scrolling below md', async () => {
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
    const expectedLevelAriaLabel = formatContentTemplate(
      enContent.common.accessibility.carouselLabelTemplate,
      { title: booking.step2Title },
    );

    const focusCarousel = screen.getByTestId('consultations-booking-focus-carousel');
    expect(focusCarousel.className).toContain('snap-mandatory');
    expect(focusCarousel.className).toContain('overflow-x-auto');
    expect(focusCarousel.getAttribute('role')).toBe('region');
    expect(focusCarousel.getAttribute('aria-label')).toBe(expectedFocusAriaLabel);
    expect(focusCarousel.getAttribute('aria-roledescription')).toBe(
      enContent.common.accessibility.carouselRoleDescription,
    );
    expect(focusCarousel.querySelectorAll(':scope > ul > li')).toHaveLength(
      booking.focusAreas.length,
    );

    const levelCarousel = screen.getByTestId('consultations-booking-level-carousel');
    expect(levelCarousel.className).toContain('snap-mandatory');
    expect(levelCarousel.className).toContain('overflow-x-auto');
    expect(levelCarousel.getAttribute('role')).toBe('region');
    expect(levelCarousel.getAttribute('aria-label')).toBe(expectedLevelAriaLabel);
    expect(levelCarousel.getAttribute('aria-roledescription')).toBe(
      enContent.common.accessibility.carouselRoleDescription,
    );
    expect(levelCarousel.querySelectorAll(':scope > ul > li')).toHaveLength(
      booking.levels.length,
    );

    expect(screen.queryByTestId('consultations-booking-focus-grid')).toBeNull();
    expect(screen.queryByTestId('consultations-booking-level-grid')).toBeNull();

    const setupScrollableTrack = (track: HTMLElement) => {
      let scrollLeftValue = 0;
      const maxScrollLeft = 500;
      Object.defineProperty(track, 'clientWidth', {
        configurable: true,
        get: () => 320,
      });
      Object.defineProperty(track, 'scrollWidth', {
        configurable: true,
        get: () => 1200,
      });
      Object.defineProperty(track, 'scrollLeft', {
        configurable: true,
        get: () => scrollLeftValue,
        set: (value: number) => {
          scrollLeftValue = value;
        },
      });
      Object.defineProperty(track, 'scrollTo', {
        configurable: true,
        value: ({ left }: { left: number }) => {
          scrollLeftValue = Math.max(0, Math.min(maxScrollLeft, left));
          track.dispatchEvent(new Event('scroll'));
        },
      });
    };

    setupScrollableTrack(focusCarousel);
    setupScrollableTrack(levelCarousel);

    fireEvent(window, new Event('resize'));

    const focusStepTitle = booking.step1Title.replace(/:\s*$/, '');
    const levelStepTitle = booking.step2Title.replace(/:\s*$/, '');
    const focusScrollRightLabel = formatContentTemplate(
      booking.scrollStepCarouselRightAriaLabelTemplate,
      { stepTitle: focusStepTitle },
    );
    const levelScrollRightLabel = formatContentTemplate(
      booking.scrollStepCarouselRightAriaLabelTemplate,
      { stepTitle: levelStepTitle },
    );

    await waitFor(() => {
      expect(screen.getByLabelText(focusScrollRightLabel)).toBeInTheDocument();
      expect(screen.getByLabelText(levelScrollRightLabel)).toBeInTheDocument();
    });

    const deepDiveButton = screen.getByRole('button', { name: 'Deep Dive' });
    fireEvent.click(deepDiveButton);
    expect(deepDiveButton.getAttribute('aria-pressed')).toBe('true');

    fireEvent.keyDown(focusCarousel, { key: 'ArrowRight' });
    fireEvent.keyDown(levelCarousel, { key: 'ArrowLeft' });
  });
});
