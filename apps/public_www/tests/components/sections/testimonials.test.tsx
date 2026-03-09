/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
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

  it('renders clone slides at both ends for seamless looping', () => {
    const { container } = render(<Testimonials content={enContent.testimonials} />);

    const realCount = enContent.testimonials.items.length;
    const articles = container.querySelectorAll('article');
    expect(articles).toHaveLength(realCount + 2);

    const cloneSlides = container.querySelectorAll('article[aria-hidden="true"]');
    expect(cloneSlides).toHaveLength(2);

    const realSlides = container.querySelectorAll('article:not([aria-hidden])');
    expect(realSlides).toHaveLength(realCount);
  });

  it('renders the author strip with five names and no service text', () => {
    render(<Testimonials content={enContent.testimonials} />);

    const strip = screen.getByTestId('testimonials-author-strip');
    expect(strip).toBeInTheDocument();

    const items = enContent.testimonials.items;
    const count = items.length;
    const activeIndex = 0;

    const prevPrevAuthor = items[(((activeIndex - 2) % count) + count) % count]?.author ?? '';
    const prevAuthor = items[(((activeIndex - 1) % count) + count) % count]?.author ?? '';
    const currentAuthor = items[activeIndex]?.author ?? '';
    const nextAuthor = items[(activeIndex + 1) % count]?.author ?? '';
    const nextNextAuthor = items[(activeIndex + 2) % count]?.author ?? '';

    expect(strip.textContent).toContain(prevPrevAuthor);
    expect(strip.textContent).toContain(prevAuthor);
    expect(strip.textContent).toContain(currentAuthor);
    expect(strip.textContent).toContain(nextAuthor);
    expect(strip.textContent).toContain(nextNextAuthor);

    const currentService = items[activeIndex]?.service ?? '';
    if (currentService) {
      expect(strip.textContent).not.toContain(currentService);
    }
  });

  it('uses snap track carousel with desktop arrow controls', () => {
    render(<Testimonials content={enContent.testimonials} />);

    const carouselTrack = screen.getByTestId('testimonials-carousel-track');
    expect(carouselTrack.className).toContain('snap-mandatory');
    expect(carouselTrack.className).toContain('overflow-x-auto');

    expect(
      screen.getByRole('button', { name: 'Next testimonial' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous testimonial' }),
    ).toBeInTheDocument();
  });
});
