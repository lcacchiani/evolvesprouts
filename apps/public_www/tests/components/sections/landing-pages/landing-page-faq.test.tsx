import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPageFaq } from '@/components/sections/landing-pages/landing-page-faq';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';

describe('LandingPageFaq section', () => {
  it('renders section shell identifiers and faq question-answer pairs', () => {
    render(<LandingPageFaq content={easterWorkshopContent.en.faq} />);

    const section = document.getElementById('landing-page-faq');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-faq');
    expect(section).toHaveClass('es-section-bg-overlay');
    expect(section).toHaveClass('es-contact-faq-section');
    expect(screen.getByRole('heading', { name: easterWorkshopContent.en.faq.title }))
      .toBeInTheDocument();

    for (const item of easterWorkshopContent.en.faq.items) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });
});
