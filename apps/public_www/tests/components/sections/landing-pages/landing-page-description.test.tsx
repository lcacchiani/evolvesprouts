import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPageDescription } from '@/components/sections/landing-pages/landing-page-description';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';

describe('LandingPageDescription section', () => {
  it('renders section shell identifiers and description items', () => {
    render(<LandingPageDescription content={easterWorkshopContent.en.description} />);

    const section = document.getElementById('landing-page-description');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-description');
    expect(section).toHaveClass('es-section-bg-overlay');
    expect(section).toHaveClass('es-landing-page-description-section');
    expect(screen.getByText(easterWorkshopContent.en.description.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: easterWorkshopContent.en.description.title }))
      .toBeInTheDocument();
    expect(document.querySelector('.es-section-header-description')).toBeNull();

    easterWorkshopContent.en.description.items.forEach((item, index) => {
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByText(item.description)).toBeInTheDocument();
      expect(
        document.querySelectorAll('.es-landing-page-description-card-number')[index],
      ).toHaveTextContent(`${index + 1}`);
    });

    expect(document.querySelectorAll('.es-landing-page-description-card').length).toBe(
      easterWorkshopContent.en.description.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-description-card-title').length).toBe(
      easterWorkshopContent.en.description.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-description-card-description').length).toBe(
      easterWorkshopContent.en.description.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-description-card-number').length).toBe(
      easterWorkshopContent.en.description.items.length,
    );
  });

  it('renders shared CTA action at the bottom when shared props are provided', () => {
    render(
      <LandingPageDescription
        content={easterWorkshopContent.en.description}
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
