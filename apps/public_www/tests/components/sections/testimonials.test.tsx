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
    expect(
      screen.getByAltText(`${firstStory.author} testimonial image`).className,
    ).toContain('rounded-card-lg');
    expect(screen.getByAltText(`${firstStory.author} avatar`).className).toContain(
      'rounded-card-lg',
    );
    expect(container.querySelector('.es-testimonial-quote-icon')).not.toBeNull();
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
