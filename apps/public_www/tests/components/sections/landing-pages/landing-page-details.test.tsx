import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPageDetails } from '@/components/sections/landing-pages/landing-page-details';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';

describe('LandingPageDetails section', () => {
  it('renders section shell identifiers and workshop details items', () => {
    render(<LandingPageDetails content={easterWorkshopContent.en.details} />);

    const section = document.getElementById('landing-page-details');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-details');
    expect(section).toHaveClass('es-section-bg-overlay');
    expect(section).toHaveClass('es-landing-page-details-section');
    expect(screen.getByText(easterWorkshopContent.en.details.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: easterWorkshopContent.en.details.title }))
      .toBeInTheDocument();
    expect(document.querySelector('.es-section-header-description')).toBeNull();
    expect(screen.getByTestId('landing-page-details-mobile-carousel')).toBeInTheDocument();

    for (const item of easterWorkshopContent.en.details.items) {
      expect(screen.getByText(item.icon)).toBeInTheDocument();
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByText(item.description)).toBeInTheDocument();
    }

    expect(document.querySelectorAll('.es-landing-page-details-card').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-details-card-icon').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-details-card-title').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-details-card-description').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
  });

  it('renders shared CTA action at the bottom when shared props are provided', () => {
    render(
      <LandingPageDetails
        content={easterWorkshopContent.en.details}
        sharedCtaProps={{
          locale: 'en',
          slug: 'easter-2026-montessori-play-coaching-workshop',
          content: easterWorkshopContent.en.cta,
          commonContent: enContent.landingPages.common,
          bookingPayload: null,
          isFullyBooked: false,
          bookingModalContent: enContent.bookingModal,
        }}
      />,
    );

    expect(
      screen.getByRole('button', { name: easterWorkshopContent.en.cta.buttonLabel }),
    ).toBeInTheDocument();
  });
});
