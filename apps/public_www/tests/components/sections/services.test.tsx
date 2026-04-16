/* eslint-disable @next/next/no-img-element */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Services } from '@/components/sections/services';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

const originalIntersectionObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

function getCardRevealDelay(id: string): string | null {
  const el = document.querySelector(`[data-service-card-id="${id}"]`);
  return el?.getAttribute('data-auto-reveal-delay') ?? null;
}

describe('Services', () => {
  it('falls back to default copy and metadata when section content is sparse and renders three service link cards', () => {
    const sparseContent = {
      ...enContent.services,
      eyebrow: '',
      title: '',
      items: [],
    };

    render(<Services content={sparseContent} />);

    expect(
      screen.getByRole('heading', { name: enContent.services.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(enContent.services.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Go to My Best Auntie Programme' }),
    ).toHaveAttribute('href', '/services/my-best-auntie-training-course');
    expect(
      screen.getByRole('link', { name: 'Go to Family Consultations' }),
    ).toHaveAttribute('href', '/services/consultations');
    expect(
      screen.getByRole('link', { name: 'Go to Free Guides & Resources' }),
    ).toHaveAttribute('href', '/services/free-guides-and-resources');

    const cardsGrid = screen
      .getByRole('link', { name: 'Go to My Best Auntie Programme' })
      .closest('ul');
    expect(cardsGrid).not.toBeNull();
    expect(cardsGrid?.parentElement?.className).toContain('mt-12');
    expect(cardsGrid?.parentElement?.className).toContain('sm:mt-14');
    expect(cardsGrid?.parentElement?.className).toContain('xl:mt-16');

    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(3);
    expect(document.querySelectorAll('.es-service-card--green').length).toBeGreaterThan(
      0,
    );
    expect(document.querySelectorAll('.es-service-card--gold')).toHaveLength(0);
  });

  it('passes staggered autoRevealDelayMs after the grid intersects the viewport', async () => {
    let captured: {
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      callback: IntersectionObserverCallback;
    } | null = null;

    class MockIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn();
      root: Element | null = null;
      rootMargin = '';
      thresholds: ReadonlyArray<number> = [];

      constructor(public callback: IntersectionObserverCallback) {
        captured = this;
      }
    }

    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;

    const sparseContent = {
      ...enContent.services,
      eyebrow: '',
      title: '',
      items: [],
    };

    render(<Services content={sparseContent} />);

    await waitFor(() => {
      expect(captured).not.toBeNull();
      expect(captured!.observe).toHaveBeenCalled();
    });

    const observedTarget = captured!.observe.mock.calls[0][0] as Element;

    expect(getCardRevealDelay('my-best-auntie')).toBeNull();
    expect(getCardRevealDelay('family-consultations')).toBeNull();
    expect(getCardRevealDelay('free-guides')).toBeNull();

    captured!.callback(
      [
        {
          isIntersecting: true,
          target: observedTarget,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );

    await waitFor(() => {
      expect(getCardRevealDelay('my-best-auntie')).toBe('400');
    });

    expect(getCardRevealDelay('family-consultations')).toBe('550');
    expect(getCardRevealDelay('free-guides')).toBe('700');
    expect(captured!.disconnect).toHaveBeenCalled();
  });
});
