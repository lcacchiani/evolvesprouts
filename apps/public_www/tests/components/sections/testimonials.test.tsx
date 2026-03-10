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

  it('renders the author strip with five circular initial buttons in an arc', () => {
    render(<Testimonials content={enContent.testimonials} />);

    const strip = screen.getByTestId('testimonials-author-strip');
    expect(strip).toBeInTheDocument();
    expect(strip.className).toContain('sm:hidden');

    const buttons = strip.querySelectorAll('button');
    expect(buttons).toHaveLength(5);

    const currentButton = strip.querySelector('[aria-current="true"]');
    expect(currentButton).not.toBeNull();

    const items = enContent.testimonials.items;
    const currentAuthor = items[0]?.author ?? '';
    const toInitials = (name: string) =>
      name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();

    expect(currentButton?.textContent).toBe(toInitials(currentAuthor));
    expect(currentButton?.getAttribute('aria-label')).toContain(currentAuthor);

    const allInitials = Array.from(buttons).map((b) => b.textContent);
    expect(allInitials.every((t) => t && t.length === 2)).toBe(true);

    const currentService = items[0]?.service ?? '';
    if (currentService) {
      expect(strip.textContent).not.toContain(currentService);
    }
  });

  it('uses snap track carousel with desktop arrow controls', () => {
    const { container } = render(<Testimonials content={enContent.testimonials} />);

    const carouselTrack = screen.getByTestId('testimonials-carousel-track');
    expect(carouselTrack.className).toContain('snap-mandatory');
    expect(carouselTrack.className).toContain('overflow-x-auto');

    const nextButton = screen.getByRole('button', { name: 'Next testimonial' });
    const previousButton = screen.getByRole('button', { name: 'Previous testimonial' });

    expect(nextButton).toBeInTheDocument();
    expect(previousButton).toBeInTheDocument();
    const desktopControls = screen.getByTestId('testimonials-desktop-controls');
    expect(desktopControls.className).toContain('sm:block');

    const activeSlideAuthorRow = container.querySelector(
      'article:not([aria-hidden]) [data-testid="testimonial-author-row"]',
    );
    expect(activeSlideAuthorRow).not.toBeNull();

    const authorText = container.querySelector(
      'article:not([aria-hidden]) .es-testimonials-author',
    );
    const metaText = container.querySelector(
      'article:not([aria-hidden]) .es-testimonials-meta',
    );

    expect(authorText?.className).toContain('max-w-[350px]');
    expect(metaText?.className).toContain('max-w-[350px]');

    const activeSlide = container.querySelector('article:not([aria-hidden])');
    expect(activeSlide?.contains(previousButton)).toBe(false);
    expect(activeSlide?.contains(nextButton)).toBe(false);
  });
});
