import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LandingPageCta } from '@/components/sections/landing-pages/landing-page-cta';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';
import { trackAnalyticsEvent } from '@/lib/analytics';
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
  it('opens booking modal and tracks CTA, modal-open, and meta pixel events', async () => {
    render(
      <LandingPageCta
        locale='en'
        slug='easter-2026-montessori-play-coaching-workshop'
        content={easterWorkshopContent.en.cta}
        commonContent={enContent.landingPages.common}
        bookingContent={easterWorkshopContent.en.booking}
        bookingModalContent={enContent.bookingModal}
      />,
    );

    const section = document.getElementById('landing-page-cta');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-cta');
    expect(section).toHaveClass('es-bg-surface-white');

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

  it('disables CTA button when all cohorts are fully booked', () => {
    const fullyBookedContent = {
      ...easterWorkshopContent.en.booking,
      cohorts: easterWorkshopContent.en.booking.cohorts.map((cohort) => ({
        ...cohort,
        is_fully_booked: true,
        spaces_left: 0,
      })),
    };

    render(
      <LandingPageCta
        locale='en'
        slug='easter-2026-montessori-play-coaching-workshop'
        content={easterWorkshopContent.en.cta}
        commonContent={enContent.landingPages.common}
        bookingContent={fullyBookedContent}
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
        bookingContent={easterWorkshopContent.en.booking}
        bookingModalContent={enContent.bookingModal}
      />,
    );

    expect(
      screen.getByRole('button', { name: enContent.landingPages.common.defaultCtaLabel }),
    ).toBeInTheDocument();
  });
});
