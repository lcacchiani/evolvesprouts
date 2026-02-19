/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CourseHighlightCard } from '@/components/sections/course-highlight-card';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

function hasClassToken(className: string, token: string): boolean {
  return className.split(/\s+/).includes(token);
}

describe('CourseHighlightCard description visibility transition', () => {
  it('uses immediate hide classes when toggled inactive', () => {
    render(
      <CourseHighlightCard
        id='age-specific'
        title='Age Specific Strategies'
        imageSrc='/images/course-highlights/course-card-1.webp'
        imageWidth={344}
        imageHeight={309}
        imageClassName='h-[235px]'
        description='Practical scripts and examples'
        tone='gold'
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: 'Show details for Age Specific Strategies',
    });
    const description = screen.getByText('Practical scripts and examples');

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(hasClassToken(description.className, 'opacity-0')).toBe(true);
    expect(hasClassToken(description.className, 'transition-none')).toBe(true);

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(hasClassToken(description.className, 'opacity-100')).toBe(true);
    expect(hasClassToken(description.className, 'transition-opacity')).toBe(true);
    expect(hasClassToken(description.className, 'duration-300')).toBe(true);

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(hasClassToken(description.className, 'opacity-0')).toBe(true);
    expect(hasClassToken(description.className, 'transition-none')).toBe(true);
  });
});
