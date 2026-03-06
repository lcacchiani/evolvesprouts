import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RealTalk } from '@/components/sections/real-talk';
import enContent from '@/content/en.json';

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

describe('RealTalk', () => {
  it('falls back to default copy, keeps title-only cards, and enables mobile carousel controls', async () => {
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

    const carousel = screen.getByTestId('real-talk-mobile-carousel');
    expect(carousel.querySelectorAll('img')).toHaveLength(0);
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
        screen.getByRole('button', { name: 'Scroll real talk right' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: 'Scroll real talk left' }),
    ).not.toBeInTheDocument();

    setScrollLeft(420);
    fireEvent.scroll(carousel);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Scroll real talk left' }),
      ).toBeInTheDocument();
    });
  });
});
