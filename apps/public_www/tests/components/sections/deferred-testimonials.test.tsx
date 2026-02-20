import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import enContent from '@/content/en.json';

vi.mock('@/components/sections/deferred-testimonials-client', () => ({
  DeferredTestimonialsClient: ({
    content,
  }: {
    content: { title: string };
  }) => <div data-testid='deferred-testimonials-client'>{content.title}</div>,
}));

describe('DeferredTestimonials', () => {
  it('forwards content to the deferred client component', () => {
    render(<DeferredTestimonials content={enContent.testimonials} />);

    expect(screen.getByTestId('deferred-testimonials-client')).toHaveTextContent(
      enContent.testimonials.title,
    );
  });
});
