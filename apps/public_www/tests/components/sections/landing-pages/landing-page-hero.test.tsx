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
    render(
      <LandingPageHero
        content={easterWorkshopContent.en.hero}
        title='Easter 2026 Montessori Play Coaching Workshop'
        chips={[
          '10:00 - 11:00am',
          'Wan Chai',
          '1-4',
          'Parent + Child',
          'Helpers Welcome',
          'Workshop',
        ]}
      />,
    );

    const section = document.getElementById('landing-page-hero');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-hero');
    expect(section).toHaveClass('es-bg-surface-white');
    expect(screen.getByRole('heading', { name: 'Easter 2026 Montessori Play Coaching Workshop' }))
      .toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.subtitle)).toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.description)).toBeInTheDocument();
    expect(screen.getByText('10:00 - 11:00am')).toBeInTheDocument();
    expect(screen.getByText('Wan Chai')).toBeInTheDocument();
    expect(screen.getByText('1-4')).toBeInTheDocument();
    expect(screen.getByText('Parent + Child')).toBeInTheDocument();
    expect(screen.getByText('Helpers Welcome')).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
    expect(
      screen.getAllByRole('img', { name: easterWorkshopContent.en.hero.imageAlt }),
    ).toHaveLength(2);
  });
});
