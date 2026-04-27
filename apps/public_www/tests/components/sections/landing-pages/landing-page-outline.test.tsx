import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPageOutline } from '@/components/sections/landing-pages/landing-page-outline';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';
import { LandingPageCalendarContext } from '@/lib/landing-page-calendar-context';
import { buildLandingPageSharedCtaPropsFromCalendar } from '@/lib/landing-page-cta-resolve';

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

  it('renders shared CTA action at the bottom when calendar context is provided', () => {
    const sharedCtaProps = buildLandingPageSharedCtaPropsFromCalendar(
      'en',
      'easter-2026-montessori-play-coaching-workshop',
      easterWorkshopContent.en.cta,
      enContent,
      easterWorkshopContent.en.meta.title,
      null,
      null,
    );
    render(
      <LandingPageCalendarContext.Provider
        value={{
          heroEventContent: null,
          bookingEventContent: null,
          structuredDataContent: null,
          sharedCtaProps,
          isRefreshing: false,
          hasRefreshError: false,
        }}
      >
        <LandingPageOutline content={easterWorkshopContent.en.outline} />
      </LandingPageCalendarContext.Provider>,
    );

    expect(
      screen.getByRole('button', { name: easterWorkshopContent.en.cta.buttonLabel }),
    ).toBeInTheDocument();
  });
});
