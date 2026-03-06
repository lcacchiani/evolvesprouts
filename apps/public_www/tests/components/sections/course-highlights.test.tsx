/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CourseHighlights } from '@/components/sections/course-highlights';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('CourseHighlights', () => {
  it('falls back to default copy and metadata when section content is sparse, uses green card tones, and keeps mobile carousel swipe-only', () => {
    const sparseContent = {
      ...enContent.courseHighlights,
      eyebrow: '',
      title: '',
      description: '',
      ctaLabel: '',
      ctaHref: '',
      items: [],
    };

    render(<CourseHighlights content={sparseContent} />);

    expect(
      screen.getByRole('heading', { name: enContent.courseHighlights.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(enContent.courseHighlights.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: enContent.courseHighlights.ctaLabel }),
    ).toHaveAttribute('href', enContent.courseHighlights.ctaHref);

    const cards = screen.getAllByRole('button', { name: /show details for/i });
    expect(cards).toHaveLength(6);
    expect(document.querySelectorAll('.es-course-highlight-card--green').length).toBeGreaterThan(
      0,
    );
    expect(document.querySelectorAll('.es-course-highlight-card--gold')).toHaveLength(0);

    const carousel = screen.getByTestId('course-highlights-mobile-carousel');
    expect(carousel.className).toContain('snap-mandatory');
    expect(carousel.className).toContain('overflow-x-auto');
    expect(
      screen.queryByRole('button', { name: 'Scroll course highlights left' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Scroll course highlights right' }),
    ).not.toBeInTheDocument();
  });
});
