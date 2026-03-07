/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Testimonials } from '@/components/sections/testimonials';
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

function defineCarouselMetrics(carousel: HTMLElement, metrics: {
  clientWidth: number;
  scrollWidth: number;
  initialScrollLeft?: number;
}) {
  let scrollLeft = metrics.initialScrollLeft ?? 0;
  const scrollBySpy = vi.fn(({ left }: { left: number }) => {
    scrollLeft += left;
  });
  const scrollToSpy = vi.fn(({ left }: { left: number }) => {
    scrollLeft = left;
  });

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
    value: scrollBySpy,
  });
  Object.defineProperty(carousel, 'scrollTo', {
    configurable: true,
    value: scrollToSpy,
  });

  return {
    scrollBySpy,
    scrollToSpy,
    setScrollLeft: (value: number) => {
      scrollLeft = value;
    },
  };
}

describe('Testimonials section', () => {
  it('removes outer card border/corner classes and keeps rounded media', () => {
    const { container } = render(<Testimonials content={enContent.testimonials} />);

    const card = screen.getByTestId('testimonials-card');
    expect(card.className).not.toContain('border-[#EFD7C7]');
    expect(card.className).not.toContain('rounded-card-lg');
    expect(card.className).not.toContain('shadow');
    const mobileControls = container.querySelector(
      '[data-css-fallback="hide-when-css-missing"]',
    );
    expect(mobileControls).toBeNull();

    const firstStory = enContent.testimonials.items[0];
    const firstStoryImage = screen.getByAltText(
      `${firstStory.author} testimonial image`,
    );
    expect(firstStoryImage.className).toContain('rounded-card-lg');
    expect(firstStoryImage).toHaveAttribute('sizes', '200px');
    expect(firstStoryImage.parentElement?.className).toContain('max-w-[200px]');
    expect(firstStoryImage.parentElement?.className).toContain('lg:mt-[70px]');
    expect(firstStoryImage.parentElement?.className).toContain('aspect-square');
    expect(screen.queryByAltText(`${firstStory.author} avatar`)).not.toBeInTheDocument();
    expect(container.querySelector('.es-testimonial-quote-icon')).not.toBeNull();

    const splitLayout = container.querySelector('.es-section-split-layout--testimonials');
    const rightColumnClassName = splitLayout?.children[1]?.className ?? '';
    expect(rightColumnClassName).toContain('px-6');
    expect(rightColumnClassName).toContain('sm:px-9');
    expect(rightColumnClassName).not.toContain('p-6');
    expect(rightColumnClassName).not.toContain('sm:p-9');
    expect(rightColumnClassName).not.toContain('lg:pb-10');
    expect(rightColumnClassName).not.toContain('lg:pt-12');
  });

  it('uses snap track navigation with desktop controls and stops at boundaries', async () => {
    const { container } = render(<Testimonials content={enContent.testimonials} />);

    const carouselTrack = screen.getByTestId('testimonials-carousel-track');
    expect(carouselTrack.className).toContain('snap-mandatory');
    expect(carouselTrack.className).toContain('overflow-x-auto');
    expect(container.querySelectorAll('article')).toHaveLength(
      enContent.testimonials.items.length,
    );

    const { scrollBySpy, setScrollLeft } = defineCarouselMetrics(
      carouselTrack,
      {
        clientWidth: 800,
        scrollWidth: 1600,
        initialScrollLeft: 0,
      },
    );

    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next testimonial' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next testimonial' }));
    expect(scrollBySpy).toHaveBeenCalledWith({
      left: 640,
      behavior: 'smooth',
    });

    setScrollLeft(800);
    fireEvent.scroll(carouselTrack);
    fireEvent.click(screen.getByRole('button', { name: 'Next testimonial' }));
    expect(carouselTrack.scrollLeft).toBe(800);
  });
});
