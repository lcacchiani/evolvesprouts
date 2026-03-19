import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPageDetails } from '@/components/sections/landing-pages/landing-page-details';
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

    easterWorkshopContent.en.details.items.forEach((item, index) => {
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByText(item.description)).toBeInTheDocument();
      expect(
        document.querySelectorAll('.es-landing-page-details-card-number')[index],
      ).toHaveTextContent(`${index + 1}`);
    });

    expect(document.querySelectorAll('.es-landing-page-details-card').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-details-card-title').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-details-card-description').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
    expect(document.querySelectorAll('.es-landing-page-details-card-number').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
  });
});
