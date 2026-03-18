import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LandingPageCta } from '@/components/sections/landing-pages/landing-page-cta';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';
import { trackAnalyticsEvent } from '@/lib/analytics';
import type { EventBookingModalPayload } from '@/lib/events-data';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid='landing-page-modal' />,
}));

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
}));
vi.mock('@/lib/meta-pixel', () => ({
  trackMetaPixelEvent: vi.fn(),
}));

const mockedTrackAnalyticsEvent = vi.mocked(trackAnalyticsEvent);
const mockedTrackMetaPixelEvent = vi.mocked(trackMetaPixelEvent);

afterEach(() => {
  mockedTrackAnalyticsEvent.mockReset();
  mockedTrackMetaPixelEvent.mockReset();
});

describe('LandingPageCta section', () => {
  const bookingPayload: EventBookingModalPayload = {
    variant: 'event',
    bookingSystem: 'event-booking',
    title: 'Easter 2026 Montessori Play Coaching Workshop',
    subtitle: 'A practical workshop',
    originalAmount: 350,
    locationName: 'Baumhaus',
    locationAddress: "Baumhaus, 1/F Kar Yau Building, 36-44 Queen's Rd E, Wan Chai",
    directionHref:
      'https://www.google.com/maps/dir/?api=1&destination=Baumhaus,+1/F+Kar+Yau+Building,+36-44+Queen%27s+Rd+E,+Wan+Chai',
    dateParts: [
      {
        id: 'session-1',
        startDateTime: '2026-04-06T02:00:00Z',
        endDateTime: '2026-04-06T03:00:00Z',
        description: 'A practical workshop',
      },
    ],
    selectedDateLabel: '06 Apr 2026',
    selectedDateStartTime: '2026-04-06T02:00:00Z',
  };

  it('opens booking modal and tracks CTA, modal-open, and meta pixel events', async () => {
    render(
      <LandingPageCta
        locale='en'
        slug='easter-2026-montessori-play-coaching-workshop'
        content={easterWorkshopContent.en.cta}
        commonContent={enContent.landingPages.common}
        bookingPayload={bookingPayload}
        isFullyBooked={false}
        bookingModalContent={enContent.bookingModal}
      />,
    );

    const section = document.getElementById('landing-page-cta');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-cta');
    expect(section).toHaveClass('es-landing-page-cta-section');

    fireEvent.click(
      screen.getByRole('button', {
        name: easterWorkshopContent.en.cta.buttonLabel,
      }),
    );

    expect(screen.getByTestId('landing-page-modal')).toBeInTheDocument();
    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'landing_page_cta_click',
      expect.objectContaining({
        sectionId: 'landing-page-cta',
        ctaLocation: 'landing_page',
        params: expect.objectContaining({
          landing_page_slug: 'easter-2026-montessori-play-coaching-workshop',
        }),
      }),
    );
    await waitFor(() => {
      expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
        'booking_modal_open',
        expect.objectContaining({
          sectionId: 'landing-page-cta',
          ctaLocation: 'landing_page',
        }),
      );
    });
    expect(mockedTrackMetaPixelEvent).toHaveBeenCalledWith('InitiateCheckout', {
      content_name: 'easter-2026-montessori-play-coaching-workshop',
    });
  });

  it('disables CTA button when event is fully booked', () => {
    render(
      <LandingPageCta
        locale='en'
        slug='easter-2026-montessori-play-coaching-workshop'
        content={easterWorkshopContent.en.cta}
        commonContent={enContent.landingPages.common}
        bookingPayload={bookingPayload}
        isFullyBooked
        bookingModalContent={enContent.bookingModal}
      />,
    );

    expect(
      screen.getByRole('button', { name: easterWorkshopContent.en.cta.buttonLabel }),
    ).toBeDisabled();
  });

  it('falls back to landingPages.common.defaultCtaLabel when buttonLabel is empty', () => {
    render(
      <LandingPageCta
        locale='en'
        slug='easter-2026-montessori-play-coaching-workshop'
        content={{
          ...easterWorkshopContent.en.cta,
          buttonLabel: '',
        }}
        commonContent={enContent.landingPages.common}
        bookingPayload={bookingPayload}
        isFullyBooked={false}
        bookingModalContent={enContent.bookingModal}
      />,
    );

    expect(
      screen.getByRole('button', { name: enContent.landingPages.common.defaultCtaLabel }),
    ).toBeInTheDocument();
  });
});
