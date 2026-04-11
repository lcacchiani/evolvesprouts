/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsultationsHero } from '@/components/sections/consultations/consultations-hero';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority: _fetchPriority,
    priority: _priority,
    ...props
  }: {
    alt?: string;
    fetchPriority?: string;
    priority?: boolean;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('ConsultationsHero section', () => {
  it('matches landing page hero shell, image wrap, and image from locale content', () => {
    const hero = enContent.consultations.hero;

    render(<ConsultationsHero content={hero} />);

    const section = document.getElementById('consultations-hero');
    expect(section).not.toBeNull();
    expect(section).toHaveClass(
      'es-landing-page-hero-section',
      'es-bg-surface-white',
      'overflow-x-clip',
    );
    expect(section?.getAttribute('data-figma-node')).toBe('consultations-hero');

    const heroImage = screen.getByRole('img', { name: hero.imageAlt });
    expect(heroImage).toHaveAttribute('src', hero.imageSrc);
    expect(heroImage).toHaveClass('relative', 'z-10', 'rounded-panel');

    expect(heroImage.parentElement).toHaveClass(
      'es-landing-page-hero-image-wrap',
      'max-w-[90%]',
    );

    expect(heroImage.parentElement?.parentElement).toHaveClass(
      'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
    );
  });
});
