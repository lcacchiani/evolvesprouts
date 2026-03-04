/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(mobileControls).not.toBeNull();

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

  it('renders one active story at a time and swaps content when navigating', () => {
    const { container } = render(<Testimonials content={enContent.testimonials} />);
    const firstQuote = enContent.testimonials.items[0].quote;
    const secondQuote = enContent.testimonials.items[1].quote;

    expect(screen.getByText(firstQuote)).toBeInTheDocument();
    expect(screen.queryByText(secondQuote)).not.toBeInTheDocument();
    expect(container.querySelectorAll('article')).toHaveLength(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Next testimonial' })[0]);

    expect(screen.queryByText(firstQuote)).not.toBeInTheDocument();
    expect(screen.getByText(secondQuote)).toBeInTheDocument();
    expect(container.querySelectorAll('article')).toHaveLength(1);
  });
});
