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
    expect(section).toHaveClass('es-course-highlights-section');
    expect(screen.getByRole('heading', { name: easterWorkshopContent.en.details.title }))
      .toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.details.description)).toBeInTheDocument();

    for (const item of easterWorkshopContent.en.details.items) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByText(item.description)).toBeInTheDocument();
    }

    expect(document.querySelectorAll('.es-course-highlight-card--gold').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.es-course-highlight-card--green').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.es-course-highlight-card--blue').length).toBeGreaterThan(0);
  });
});
