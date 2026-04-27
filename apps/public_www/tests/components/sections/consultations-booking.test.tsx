import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConsultationsBooking } from '@/components/sections/consultations/consultations-booking';
import enContent from '@/content/en.json';
import calendarAvailability from '@/content/calendar-availability.json';
import { formatContentTemplate } from '@/content/content-field-utils';
import { trackAnalyticsEvent, trackEcommerceEvent } from '@/lib/analytics';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

vi.mock('next/dynamic', () => ({
  default: () => {
    function MockDynamic() {
      return null;
    }
    return MockDynamic;
  },
}));

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
  trackEcommerceEvent: vi.fn(),
}));

vi.mock('@/lib/meta-pixel', () => ({
  trackMetaPixelEvent: vi.fn(),
}));

const mockedTrackAnalyticsEvent = vi.mocked(trackAnalyticsEvent);
const mockedTrackEcommerceEvent = vi.mocked(trackEcommerceEvent);
const mockedTrackMetaPixelEvent = vi.mocked(trackMetaPixelEvent);

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
  mockedTrackAnalyticsEvent.mockReset();
  mockedTrackEcommerceEvent.mockReset();
  mockedTrackMetaPixelEvent.mockReset();

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

    const levelBlock = screen.getByTestId('consultations-booking-level-block');
    expect(levelBlock.className).toContain('max-w-[');
    expect(levelBlock.className).not.toContain('md:grid');

    const levelGrid = screen.getByTestId('consultations-booking-level-grid');
    const levelSelectorList = levelGrid.querySelector(':scope > ul');
    expect(levelSelectorList).not.toBeNull();
    expect(levelSelectorList!.className).toContain('grid-cols-2');
    expect(levelSelectorList!.className).not.toContain('md:flex');
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
      within(levelDescription).getByRole('heading', {
        name: booking.whatYouGetHeading,
      }),
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
      within(levelDescription).getByRole('heading', {
        name: booking.whatYouGetHeading,
      }),
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

    const levelBlock = screen.getByTestId('consultations-booking-level-block');
    expect(levelBlock.className).toContain('max-w-[');

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
      within(levelDescription).getByRole('heading', {
        name: booking.whatYouGetHeading,
      }),
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
      within(levelDescription).getByRole('heading', {
        name: booking.whatYouGetHeading,
      }),
    ).toBeInTheDocument();
    for (const feature of deepDive!.features) {
      expect(within(levelDescription).getByText(feature)).toBeInTheDocument();
    }

  });

  it('fires booking_modal_open, begin_checkout, and InitiateCheckout when CTA is clicked', () => {
    mockViewportMdUp(true);
    const booking = enContent.consultations.booking;
    const essentialsTier = booking.reservation.essentials;

    render(
      <ConsultationsBooking
        locale='en'
        content={booking}
        bookingModalContent={enContent.bookingModal}
        calendarAvailability={calendarAvailability}
      />,
    );

    const ctaButton = screen.getByRole('button', { name: booking.reservation.ctaLabel });
    fireEvent.click(ctaButton);

    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith('booking_modal_open', {
      sectionId: 'consultations-booking',
      ctaLocation: 'booking_section',
      params: {
        service_tier: '',
        cohort_label: booking.levels[0]!.title,
        cohort_date: essentialsTier.dateParts[0]?.startDateTime?.split('T')[0] ?? '',
      },
    });

    expect(mockedTrackEcommerceEvent).toHaveBeenCalledWith('begin_checkout', {
      value: essentialsTier.priceHkd,
      items: [{
        item_id: 'consultation-essentials',
        item_name: booking.reservation.modalTitle,
        item_category: booking.focusAreas[0]!.title,
        price: essentialsTier.priceHkd,
        quantity: 1,
      }],
    });

    expect(mockedTrackMetaPixelEvent).toHaveBeenCalledWith('InitiateCheckout', {
      content_name: 'consultation_booking',
    });
  });

  it('fires begin_checkout with deep-dive tier when deep-dive level is selected', () => {
    mockViewportMdUp(true);
    const booking = enContent.consultations.booking;
    const deepDiveTier = booking.reservation.deepDive;
    const deepDiveLevel = booking.levels.find((l) => l.id === 'deep-dive');
    expect(deepDiveLevel).toBeDefined();

    render(
      <ConsultationsBooking
        locale='en'
        content={booking}
        bookingModalContent={enContent.bookingModal}
        calendarAvailability={calendarAvailability}
      />,
    );

    const levelGrid = screen.getByTestId('consultations-booking-level-grid');
    fireEvent.click(within(levelGrid).getByRole('button', { name: deepDiveLevel!.title }));

    const ctaButton = screen.getByRole('button', { name: booking.reservation.ctaLabel });
    fireEvent.click(ctaButton);

    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith('booking_modal_open', {
      sectionId: 'consultations-booking',
      ctaLocation: 'booking_section',
      params: {
        service_tier: '',
        cohort_label: deepDiveLevel!.title,
        cohort_date: deepDiveTier.dateParts[0]?.startDateTime?.split('T')[0] ?? '',
      },
    });

    expect(mockedTrackEcommerceEvent).toHaveBeenCalledWith('begin_checkout', {
      value: deepDiveTier.priceHkd,
      items: [{
        item_id: 'consultation-deep-dive',
        item_name: booking.reservation.modalTitle,
        item_category: booking.focusAreas[0]!.title,
        price: deepDiveTier.priceHkd,
        quantity: 1,
      }],
    });
  });
});
