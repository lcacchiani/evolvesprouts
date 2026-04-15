/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Services } from '@/components/sections/services';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('Services', () => {
  it('falls back to default copy and metadata when section content is sparse, uses green card tones, and keeps mobile carousel swipe-only', () => {
    const sparseContent = {
      ...enContent.services,
      eyebrow: '',
      title: '',
      description: '',
      ctaLabel: '',
      ctaHref: '',
      items: [],
    };

    render(<Services content={sparseContent} />);

    expect(
      screen.getByRole('heading', { name: enContent.services.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(enContent.services.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: enContent.services.ctaLabel }),
    ).toHaveAttribute('href', enContent.services.ctaHref);

    const cards = screen.getAllByRole('button', { name: /show details for/i });
    expect(cards).toHaveLength(6);
    expect(document.querySelectorAll('.es-service-card--green').length).toBeGreaterThan(
      0,
    );
    expect(document.querySelectorAll('.es-service-card--gold')).toHaveLength(0);

    const carouselTrack = screen.getByTestId('services-mobile-carousel');
    expect(carouselTrack.className).toContain('snap-mandatory');
    expect(carouselTrack.className).toContain('overflow-x-auto');
    expect(carouselTrack.getAttribute('role')).toBe('region');
    expect(carouselTrack.getAttribute('aria-roledescription')).toBe('carousel');
    expect(
      screen.queryByRole('button', { name: 'Scroll services left' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Scroll services right' }),
    ).not.toBeInTheDocument();
  });
});
