/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyBestAuntieHero } from '@/components/sections/my-best-auntie/my-best-auntie-hero';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    priority: _priority,
    ...props
  }: {
    alt?: string;
    priority?: boolean;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('MyBestAuntieHero', () => {
  it('renders a standalone hero with h1 copy and booking CTA', () => {
    const content = enContent.myBestAuntie.hero;
    render(<MyBestAuntieHero content={content} />);

    const heading = screen.getByRole('heading', { level: 1, name: content.title });
    expect(heading).toBeInTheDocument();
    const section = screen.getByRole('region', { name: content.title });
    expect(section).toHaveClass(
      'es-my-best-auntie-hero-section',
    );
    expect(section.className).toContain('pt-0');
    expect(section.className).toContain('sm:pt-[60px]');
    expect(screen.getByText(content.subtitle)).toBeInTheDocument();
    expect(
      screen.getByText(/Your helper spends more waking hours with your child/),
    ).toBeInTheDocument();

    const ctaLink = screen.getByRole('link', { name: content.ctaLabel });
    expect(ctaLink).toHaveAttribute('href', content.ctaHref);
    expect(ctaLink.className).toContain('es-btn--primary');
    expect(ctaLink.className).not.toContain('es-btn--outline');
    expect(ctaLink.className).toContain('mt-auto');
    expect(ctaLink.className).toContain('max-w-[360px]');

    const image = screen.getByRole('img', { name: content.imageAlt });
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      'src',
      '/images/hero/my-best-auntie-hero.webp',
    );
    expect(image.className).toContain('es-my-best-auntie-hero-image-flipped');
    expect(image.closest('div')).toHaveClass(
      'es-my-best-auntie-hero-image-wrap',
      'max-w-[500px]',
    );
  });

  it('renders hero quick facts as chips with icons like the landing page hero', () => {
    const content = enContent.myBestAuntie.hero;
    render(
      <MyBestAuntieHero
        content={content}
        lowestPrice={9000}
        nextCohortLabel='Apr, 2026'
      />,
    );

    const chipRow = screen.getByTestId('my-best-auntie-hero-quick-facts');
    expect(chipRow).toHaveClass('flex', 'flex-wrap', 'gap-3');

    const chips = chipRow.querySelectorAll('span.rounded-full');
    expect(chips.length).toBe(4);
    chips.forEach((chip) => {
      expect(chip.className).toContain('es-border-soft');
      expect(chip.className).toContain('es-bg-surface-soft');
    });

    expect(chipRow.querySelector('img[src="/images/clock.svg"]')).toBeInTheDocument();
    expect(chipRow.querySelector('img[src="/images/dollar-symbol.svg"]')).toBeInTheDocument();
    expect(chipRow.querySelector('img[src="/images/calendar.svg"]')).toBeInTheDocument();
    expect(chipRow.querySelector('img[src="/images/home.svg"]')).toBeInTheDocument();

    expect(screen.getByText('9 weeks')).toBeInTheDocument();
    expect(screen.getByText('From HK$9,000')).toBeInTheDocument();
    expect(screen.getByText('Next: Apr, 2026')).toBeInTheDocument();
    expect(screen.getByText('3 home visits')).toBeInTheDocument();
  });
});
