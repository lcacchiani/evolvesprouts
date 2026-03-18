/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LandingPageHero } from '@/components/sections/landing-pages/landing-page-hero';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('LandingPageHero section', () => {
  it('renders section shell identifiers and hero content', () => {
    render(<LandingPageHero content={easterWorkshopContent.en.hero} />);

    const section = document.getElementById('landing-page-hero');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-hero');
    expect(screen.getByRole('heading', { name: easterWorkshopContent.en.hero.title }))
      .toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.subtitle)).toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.description)).toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.dateLabel)).toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.locationLabel)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: easterWorkshopContent.en.hero.imageAlt }))
      .toBeInTheDocument();
  });
});
