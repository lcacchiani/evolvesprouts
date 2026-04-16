/* eslint-disable @next/next/no-img-element */
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  imageClassName: 'h-[235px]',
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
  vi.useRealTimers();

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

function getCardDescriptionParagraph(card: HTMLElement | null): HTMLElement | null {
  return card?.querySelector('p.es-service-card-description') ?? null;
}

function getCardDescriptionPreview(card: HTMLElement | null): HTMLElement | null {
  return card?.querySelector('.es-service-card-description-preview') ?? null;
}

function getCardOverlay(card: HTMLElement | null): HTMLElement | null {
  if (!card || card.children.length === 0) {
    return null;
  }

  return card.children[0] as HTMLElement;
}

function overlayShowsExpanded(overlay: HTMLElement): boolean {
  return (
    hasClassToken(overlay.className, 'bg-black/70') &&
    !hasClassToken(overlay.className, 'bg-black/0')
  );
}

function mockReducedMotion(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
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

describe('ServiceCard description visibility transition', () => {
  it('renders arrow as a link CTA with go-to aria label', () => {
    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const description = getCardDescriptionParagraph(card);
    const serviceLink = screen.getByRole('link', {
      name: 'Go to Age Specific Strategies',
    });
    const pulseRing = document.querySelector('.es-service-arrow-ring-target');

    expect(card).not.toBeNull();
    expect(description).not.toBeNull();
    expect(card?.className).toContain('group');
    expect(serviceLink).toHaveAttribute('href', BASE_PROPS.href);
    expect(pulseRing).not.toBeNull();
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'es-service-arrow-ring-target--brand'),
    ).toBe(true);
    expect(description!.className).toContain('group-hover:opacity-100');
    expect(description!.className).not.toContain('lg:group-hover:opacity-100');
    expect(serviceLink.className).toContain('group-hover:h-[70px]');
    expect(serviceLink.className).not.toContain('lg:group-hover:h-[70px]');
  });

  it('uses immediate hide classes when toggled inactive and animates pulse ring when active', () => {
    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const description = getCardDescriptionParagraph(card);
    const pulseRing = document.querySelector('.es-service-arrow-ring-target');

    expect(card).not.toBeNull();
    expect(description).not.toBeNull();
    expect(card).toHaveAttribute('aria-expanded', 'false');
    expect(pulseRing).not.toBeNull();
    expect(hasClassToken(description!.className, 'opacity-0')).toBe(true);
    expect(hasClassToken(description!.className, 'transition-none')).toBe(true);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'es-service-arrow-ring'),
    ).toBe(false);

    fireEvent.click(card as HTMLElement);

    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(hasClassToken(description!.className, 'opacity-100')).toBe(true);
    expect(hasClassToken(description!.className, 'transition-opacity')).toBe(true);
    expect(hasClassToken(description!.className, 'duration-300')).toBe(true);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'es-service-arrow-ring'),
    ).toBe(true);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'opacity-100'),
    ).toBe(true);

    fireEvent.click(card as HTMLElement);

    expect(card).toHaveAttribute('aria-expanded', 'false');
    expect(hasClassToken(description!.className, 'opacity-0')).toBe(true);
    expect(hasClassToken(description!.className, 'transition-none')).toBe(true);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'es-service-arrow-ring'),
    ).toBe(false);
    expect(
      hasClassToken((pulseRing as HTMLElement).className, 'opacity-0'),
    ).toBe(true);
  });

  it('renders a description preview teaser with expected visibility classes', () => {
    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const preview = getCardDescriptionPreview(card);

    expect(preview).not.toBeNull();
    expect(preview).toHaveAttribute('aria-hidden', 'true');
    expect(preview!.className).toContain('es-service-card-description-preview');
    expect(hasClassToken(preview!.className, 'opacity-70')).toBe(true);
    expect(preview!.className).toContain('group-hover:opacity-0');
    expect(preview!.className).toContain('duration-150');
    expect(hasClassToken(preview!.className, 'opacity-0')).toBe(false);
  });

  it('hides the description preview when the card is active', () => {
    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const preview = getCardDescriptionPreview(card);

    expect(preview).not.toBeNull();
    expect(hasClassToken(preview!.className, 'opacity-70')).toBe(true);

    fireEvent.click(card as HTMLElement);

    expect(hasClassToken(preview!.className, 'opacity-0')).toBe(true);
    expect(hasClassToken(preview!.className, 'opacity-70')).toBe(false);
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

describe('ServiceCard auto-reveal demo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInteractionCapabilities({
      isDesktopViewport: false,
      canHover: true,
    });
  });

  it('expands visually after delay and collapses after hold while aria-expanded stays false', () => {
    render(<ServiceCard {...BASE_PROPS} autoRevealDelayMs={400} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const overlay = getCardOverlay(card);
    const serviceLink = screen.getByRole('link', {
      name: 'Go to Age Specific Strategies',
    });

    expect(card).not.toBeNull();
    expect(overlay).not.toBeNull();
    expect(card).toHaveAttribute('aria-expanded', 'false');
    expect(hasClassToken(overlay!.className, 'bg-black/0')).toBe(true);
    expect(hasClassToken(serviceLink.className, 'h-[54px]')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(hasClassToken(overlay!.className, 'bg-black/0')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(overlayShowsExpanded(overlay!)).toBe(true);
    expect(hasClassToken(serviceLink.className, 'h-[70px]')).toBe(true);
    expect(card).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(hasClassToken(overlay!.className, 'bg-black/0')).toBe(true);
    expect(hasClassToken(serviceLink.className, 'h-[54px]')).toBe(true);
  });

  it('does not run a second reveal after the prop changes following the first cycle', () => {
    const { rerender } = render(
      <ServiceCard {...BASE_PROPS} autoRevealDelayMs={400} />,
    );

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const overlay = getCardOverlay(card);

    act(() => {
      vi.advanceTimersByTime(2200);
    });
    expect(hasClassToken(overlay!.className, 'bg-black/0')).toBe(true);

    rerender(<ServiceCard {...BASE_PROPS} autoRevealDelayMs={800} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(hasClassToken(overlay!.className, 'bg-black/0')).toBe(true);
  });

  it('cancels reveal when the user activates the card and keeps expanded visuals from isActive', () => {
    render(<ServiceCard {...BASE_PROPS} autoRevealDelayMs={400} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const overlay = getCardOverlay(card);
    const serviceLink = screen.getByRole('link', {
      name: 'Go to Age Specific Strategies',
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(overlayShowsExpanded(overlay!)).toBe(true);

    fireEvent.click(card as HTMLElement);

    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(overlayShowsExpanded(overlay!)).toBe(true);
    expect(hasClassToken(serviceLink.className, 'h-[70px]')).toBe(true);
  });

  it('skips the reveal when prefers-reduced-motion is reduce', () => {
    mockReducedMotion();

    render(<ServiceCard {...BASE_PROPS} autoRevealDelayMs={400} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const overlay = getCardOverlay(card);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(hasClassToken(overlay!.className, 'bg-black/0')).toBe(true);
    expect(card).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not auto-expand when autoRevealDelayMs is undefined', () => {
    render(<ServiceCard {...BASE_PROPS} />);

    const heading = screen.getByRole('heading', {
      name: 'Age Specific Strategies',
    });
    const card = heading.closest('[role="button"]');
    const overlay = getCardOverlay(card);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(hasClassToken(overlay!.className, 'bg-black/0')).toBe(true);
    expect(card).toHaveAttribute('aria-expanded', 'false');
  });
});
