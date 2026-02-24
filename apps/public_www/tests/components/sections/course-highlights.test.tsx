/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function defineCarouselMetrics(carousel: HTMLElement, metrics: {
  clientWidth: number;
  scrollWidth: number;
  initialScrollLeft?: number;
}) {
  let scrollLeft = metrics.initialScrollLeft ?? 0;

  Object.defineProperty(carousel, 'clientWidth', {
    configurable: true,
    get: () => metrics.clientWidth,
  });
  Object.defineProperty(carousel, 'scrollWidth', {
    configurable: true,
    get: () => metrics.scrollWidth,
  });
  Object.defineProperty(carousel, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  Object.defineProperty(carousel, 'scrollBy', {
    configurable: true,
    value: ({ left }: { left: number }) => {
      scrollLeft += left;
    },
  });

  return {
    setScrollLeft: (value: number) => {
      scrollLeft = value;
    },
  };
}

describe('CourseHighlights', () => {
  it('falls back to default copy and metadata when section content is sparse, uses green card tones, and enables mobile carousel controls', async () => {
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

    const { setScrollLeft } = defineCarouselMetrics(carousel, {
      clientWidth: 320,
      scrollWidth: 1240,
      initialScrollLeft: 0,
    });

    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Scroll course highlights right' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: 'Scroll course highlights left' }),
    ).not.toBeInTheDocument();

    setScrollLeft(420);
    fireEvent.scroll(carousel);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Scroll course highlights left' }),
      ).toBeInTheDocument();
    });
  });
});
