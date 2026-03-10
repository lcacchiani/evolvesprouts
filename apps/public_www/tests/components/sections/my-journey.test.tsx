/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyJourney } from '@/components/sections/my-journey';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    priority: _priority,
    ...props
  }: {
    alt?: string;
    fill?: boolean;
    priority?: boolean;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('MyJourney section', () => {
  it('uses migrated overlay/card classes and renders the local journey image', () => {
    render(<MyJourney content={enContent.myJourney} />);

    const section = screen.getByRole('region', {
      name: enContent.myJourney.title,
    });

    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-my-journey-section');

    const image = screen.getByRole('img', {
      name: /my montessori journey section image/i,
    });
    expect(image).toHaveAttribute(
      'src',
      '/images/about-us/my-journey.webp',
    );
    expect(image.className).toContain('rounded-card-sm');
    expect(image.className).toContain('border');
    expect(image.className).toContain('es-border-warm-3');
    expect(image.className).toContain('brightness-[1.1]');
    expect(image.className).toContain('contrast-[1.15]');
    expect(image.className).toContain('saturate-[1.05]');
    expect(screen.getByText(enContent.myJourney.description)).toBeInTheDocument();

    const firstCard = screen
      .getByText(enContent.myJourney.cards[0].tag)
      .closest('article');
    expect(firstCard).not.toBeNull();
    expect(firstCard?.className).toContain('es-my-journey-card--blue');

    const secondCard = screen
      .getByText(enContent.myJourney.cards[1].tag)
      .closest('article');
    expect(secondCard).not.toBeNull();
    expect(secondCard?.className).toContain('es-my-journey-card--yellow');

    const firstTag = screen.getByText(enContent.myJourney.cards[0].tag);
    expect(firstTag.className).toContain('es-my-journey-tag');

    const thirdCard = screen
      .getByText(enContent.myJourney.cards[2].tag)
      .closest('article');
    expect(thirdCard).not.toBeNull();
    expect(thirdCard?.className).toContain('es-my-journey-card--blue');
  });
});
