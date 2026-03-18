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
  it('renders section shell identifiers and hero content', async () => {
    const eventContent = {
      title: 'Easter 2026 Montessori Play Coaching Workshop',
      startDateTime: '2026-04-06T02:00:00Z',
      endDateTime: '2026-04-06T03:00:00Z',
      locationLabel: 'Wan Chai',
      categoryChips: ['Workshop'],
    };
    const expectedDateChip = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(eventContent.startDateTime));
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const expectedTimeChip = `${timeFormatter.format(new Date(eventContent.startDateTime))} - ${timeFormatter.format(new Date(eventContent.endDateTime))}`;

    render(
      <LandingPageHero
        content={easterWorkshopContent.en.hero}
        locale='en'
        title={eventContent.title}
        eventContent={eventContent}
      />,
    );

    const section = document.getElementById('landing-page-hero');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-hero');
    expect(section).toHaveClass('es-bg-surface-white');
    expect(screen.getByRole('heading', { name: eventContent.title }))
      .toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.subtitle)).toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.description)).toBeInTheDocument();
    expect(await screen.findByText(expectedDateChip)).toBeInTheDocument();
    expect(await screen.findByText(expectedTimeChip)).toBeInTheDocument();
    expect(await screen.findByText('Wan Chai')).toBeInTheDocument();
    expect(await screen.findByText('Workshop')).toBeInTheDocument();
    expect(screen.queryByText('Helpers Welcome')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('img', { name: easterWorkshopContent.en.hero.imageAlt }),
    ).toHaveLength(2);
  });
});
