import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RealTalk } from '@/components/sections/real-talk';
import enContent from '@/content/en.json';

describe('RealTalk', () => {
  it('falls back to default copy, keeps title-only cards, and keeps mobile carousel swipe-only', () => {
    const sparseContent = {
      ...enContent.realTalk,
      eyebrow: '',
      title: '',
      description: '',
      ctaLabel: '',
      ctaHref: '',
      items: [],
    };

    render(<RealTalk content={sparseContent} />);

    expect(
      screen.getByRole('heading', { name: enContent.realTalk.title }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(enContent.realTalk.eyebrow).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: enContent.realTalk.ctaLabel }),
    ).toHaveAttribute('href', enContent.realTalk.ctaHref);

    for (const item of enContent.realTalk.items) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }

    expect(
      screen.queryByRole('button', { name: /show details for/i }),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll('.es-real-talk-card--green').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.es-real-talk-card--blue').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.es-testimonial-quote-icon')).toHaveLength(
      enContent.realTalk.items.length,
    );

    const carousel = screen.getByTestId('real-talk-mobile-carousel');
    expect(carousel.querySelectorAll('img')).toHaveLength(0);
    expect(carousel.className).toContain('snap-mandatory');
    expect(carousel.className).toContain('overflow-x-auto');
    expect(
      screen.queryByRole('button', { name: 'Scroll real talk left' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Scroll real talk right' }),
    ).not.toBeInTheDocument();
  });
});
