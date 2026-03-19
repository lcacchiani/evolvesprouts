import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPageOutline } from '@/components/sections/landing-pages/landing-page-outline';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';

describe('LandingPageOutline section', () => {
  it('renders section shell identifiers, copy, and highlighted phrase', () => {
    render(<LandingPageOutline content={easterWorkshopContent.en.outline} />);

    const section = document.getElementById('landing-page-outline');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-outline');
    expect(section).toHaveClass('es-section-bg-overlay');
    expect(section).toHaveClass('es-landing-page-outline-section');
    expect(screen.getByText(easterWorkshopContent.en.outline.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: easterWorkshopContent.en.outline.title }))
      .toBeInTheDocument();
    expect(screen.getByText(/your helper is often the person who spends the most time/i)).toBeInTheDocument();
    expect(screen.getByText(/this session is a first step towards that/i)).toBeInTheDocument();
    expect(screen.getByText(/when your helper is on the same page as you/i)).toBeInTheDocument();
    expect(screen.queryByText(/"When your helper is on the same page as you/i)).not.toBeInTheDocument();

    const highlightedText = screen.getByText('Evolve Sprouts programme');
    expect(highlightedText).toHaveClass('es-highlight-word');
    expect(document.querySelector('.es-quote')).not.toBeNull();
    expect(document.querySelector('.es-quote-icon.es-testimonial-quote-icon')).not.toBeNull();
  });

  it('renders shared CTA action at the bottom when shared props are provided', () => {
    render(
      <LandingPageOutline
        content={easterWorkshopContent.en.outline}
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
