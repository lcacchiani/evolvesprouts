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
  it('falls back to default copy and metadata when section content is sparse and uses green card tones', () => {
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
  });
});
