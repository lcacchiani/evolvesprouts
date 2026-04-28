import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPageDetails } from '@/components/sections/landing-pages/landing-page-details';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';
import { LandingPageCalendarContext } from '@/lib/landing-page-calendar-context';
import { buildLandingPageSharedCtaPropsFromCalendar } from '@/lib/landing-page-cta-resolve';

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
    const header = document.querySelector('#landing-page-details .es-section-header');
    expect(header).not.toBeNull();
    expect(header).toHaveClass('es-section-header--center');
    expect(header).toHaveClass('text-center');
    expect(screen.getByTestId('landing-page-details-mobile-carousel')).toBeInTheDocument();

    for (const item of easterWorkshopContent.en.details.items) {
      expect(screen.getByText(item.icon)).toBeInTheDocument();
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByText(item.description)).toBeInTheDocument();
    }

    expect(document.querySelectorAll('.es-landing-page-details-card').length).toBe(
      easterWorkshopContent.en.details.items.length,
    );
    const cards = document.querySelectorAll('.es-landing-page-details-card');
    cards.forEach((card) => {
      expect(card).toHaveClass('min-h-[200px]');
    });
    const titleRows = document.querySelectorAll('.es-landing-page-details-card-title-row');
    expect(titleRows.length).toBe(easterWorkshopContent.en.details.items.length);
    titleRows.forEach((titleRow) => {
      expect(titleRow).toHaveClass('flex');
      expect(titleRow).toHaveClass('justify-between');
    });
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

  it('renders shared CTA action at the bottom when calendar context is provided', () => {
    const sharedCtaProps = buildLandingPageSharedCtaPropsFromCalendar(
      'en',
      'easter-2026-montessori-play-coaching-workshop',
      easterWorkshopContent.en.cta,
      enContent,
      easterWorkshopContent.en.meta.title,
      null,
      null,
      undefined,
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
        <LandingPageDetails content={easterWorkshopContent.en.details} />
      </LandingPageCalendarContext.Provider>,
    );

    const ctaButton = screen.getByRole('button', {
      name: easterWorkshopContent.en.cta.buttonLabel,
    });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveClass('w-full');
    expect(ctaButton.className).toContain('max-w-[488px]');
    expect(ctaButton.parentElement).toHaveClass('mt-8');
    expect(ctaButton.parentElement).toHaveClass('flex');
    expect(ctaButton.parentElement).toHaveClass('justify-center');
  });
});
