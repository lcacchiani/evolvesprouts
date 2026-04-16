/* eslint-disable @next/next/no-img-element */
import type { ComponentProps } from 'react';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Services } from '@/components/sections/services';
import enContent from '@/content/en.json';

const { serviceCardSpy } = vi.hoisted(() => ({
  serviceCardSpy: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

vi.mock('@/components/sections/service-card', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/sections/service-card')
  >('@/components/sections/service-card');

  return {
    ...actual,
    ServiceCard: (props: ComponentProps<typeof actual.ServiceCard>) => {
      serviceCardSpy(props);
      return createElement(actual.ServiceCard, props);
    },
  };
});

const originalIntersectionObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
  serviceCardSpy.mockClear();
});

function getLastServiceCardPropsForId(
  id: string,
): ComponentProps<
  typeof import('@/components/sections/service-card').ServiceCard
> | undefined {
  let last:
    | ComponentProps<
        typeof import('@/components/sections/service-card').ServiceCard
      >
    | undefined;

  for (const call of serviceCardSpy.mock.calls) {
    const props = call[0];
    if (props.id === id) {
      last = props;
    }
  }

  return last;
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

    expect(getLastServiceCardPropsForId('my-best-auntie')?.autoRevealDelayMs).toBeUndefined();
    expect(
      getLastServiceCardPropsForId('family-consultations')?.autoRevealDelayMs,
    ).toBeUndefined();
    expect(getLastServiceCardPropsForId('free-guides')?.autoRevealDelayMs).toBeUndefined();

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
      expect(getLastServiceCardPropsForId('my-best-auntie')?.autoRevealDelayMs).toBe(400);
    });

    expect(getLastServiceCardPropsForId('family-consultations')?.autoRevealDelayMs).toBe(
      550,
    );
    expect(getLastServiceCardPropsForId('free-guides')?.autoRevealDelayMs).toBe(700);
    expect(captured!.disconnect).toHaveBeenCalled();
  });
});
