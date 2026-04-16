/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ServiceCard } from '@/components/sections/service-card';

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

const BASE_PROPS = {
  id: 'age-specific',
  title: 'Age Specific Strategies',
  href: '/services/my-best-auntie-training-course',
  imageSrc: '/images/hero/my-best-auntie-hero.webp',
  imageWidth: 1200,
  imageHeight: 900,
  imageClassName: 'h-[176px]',
  description: 'Practical scripts and examples',
  tone: 'green' as const,
};

const originalMatchMedia = window.matchMedia;
const DESKTOP_HOVER_QUERY = '(min-width: 1024px) and (hover: hover)';

function mockInteractionCapabilities({
  isDesktopViewport,
  canHover,
}: {
  isDesktopViewport: boolean;
  canHover: boolean;
}): void {
  const desktopHoverEnabled = isDesktopViewport && canHover;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === DESKTOP_HOVER_QUERY ? desktopHoverEnabled : false,
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

describe('ServiceCard description visibility transition', () => {
  it('renders arrow as a link CTA with go-to aria label', () => {
    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const description = screen.getByText('Practical scripts and examples');
    const serviceLink = screen.getByRole('link', {
      name: 'Go to Age Specific Strategies',
    });
    const pulseRing = document.querySelector('.es-service-arrow-ring-target');

    expect(card).not.toBeNull();
    expect(card?.className).toContain('group');
    expect(serviceLink).toHaveAttribute('href', BASE_PROPS.href);
    expect(pulseRing).not.toBeNull();
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'es-service-arrow-ring-target--brand'),
    ).toBe(true);
    expect(description.className).toContain('group-hover:opacity-100');
    expect(description.className).not.toContain('lg:group-hover:opacity-100');
    expect(serviceLink.className).toContain('group-hover:h-[70px]');
    expect(serviceLink.className).not.toContain('lg:group-hover:h-[70px]');
  });

  it('uses immediate hide classes when toggled inactive and animates pulse ring when active', () => {
    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const description = screen.getByText('Practical scripts and examples');
    const pulseRing = document.querySelector('.es-service-arrow-ring-target');

    expect(card).not.toBeNull();
    expect(card).toHaveAttribute('aria-expanded', 'false');
    expect(pulseRing).not.toBeNull();
    expect(hasClassToken(description.className, 'opacity-0')).toBe(true);
    expect(hasClassToken(description.className, 'transition-none')).toBe(true);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'es-service-arrow-ring'),
    ).toBe(false);

    fireEvent.click(card as HTMLElement);

    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(hasClassToken(description.className, 'opacity-100')).toBe(true);
    expect(hasClassToken(description.className, 'transition-opacity')).toBe(true);
    expect(hasClassToken(description.className, 'duration-300')).toBe(true);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'es-service-arrow-ring'),
    ).toBe(true);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'opacity-100'),
    ).toBe(true);

    fireEvent.click(card as HTMLElement);

    expect(card).toHaveAttribute('aria-expanded', 'false');
    expect(hasClassToken(description.className, 'opacity-0')).toBe(true);
    expect(hasClassToken(description.className, 'transition-none')).toBe(true);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'es-service-arrow-ring'),
    ).toBe(false);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'opacity-0'),
    ).toBe(true);
  });

  it('toggles when tapping the card surface below desktop breakpoint', () => {
    mockInteractionCapabilities({
      isDesktopViewport: false,
      canHover: true,
    });

    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');

    expect(card).not.toBeNull();
    expect(card).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(card as HTMLElement);
    expect(card).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(card as HTMLElement);
    expect(card).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles when tapping the card surface without hover support', () => {
    mockInteractionCapabilities({
      isDesktopViewport: true,
      canHover: false,
    });

    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');

    expect(card).not.toBeNull();
    expect(card).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(card as HTMLElement);
    expect(card).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps desktop card-surface clicks inert when hover is available', () => {
    mockInteractionCapabilities({
      isDesktopViewport: true,
      canHover: true,
    });

    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const serviceLink = screen.getByRole('link', {
      name: 'Go to Age Specific Strategies',
    });

    expect(card).not.toBeNull();
    expect(card).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(card as HTMLElement);
    expect(card).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(serviceLink);
    expect(card).toHaveAttribute('aria-expanded', 'false');
    expect(serviceLink).toHaveAttribute('href', BASE_PROPS.href);
  });
});
