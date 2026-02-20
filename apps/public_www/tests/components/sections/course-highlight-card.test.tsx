/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const originalMatchMedia = window.matchMedia;

function mockHoverCapability(canHover: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(hover: hover)' ? canHover : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    return;
  }

  Reflect.deleteProperty(window, 'matchMedia');
});

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

  it('toggles when tapping the card surface on non-hover devices', () => {
    mockHoverCapability(false);

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

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('article');
    const toggleButton = screen.getByRole('button', {
      name: 'Show details for Age Specific Strategies',
    });

    expect(card).not.toBeNull();
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(card as HTMLElement);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(card as HTMLElement);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps desktop card-surface clicks inert when hover is available', () => {
    mockHoverCapability(true);

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

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('article');
    const toggleButton = screen.getByRole('button', {
      name: 'Show details for Age Specific Strategies',
    });

    expect(card).not.toBeNull();
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(card as HTMLElement);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  });
});
