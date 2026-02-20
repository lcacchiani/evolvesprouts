import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeferredTestimonialsClient } from '@/components/sections/deferred-testimonials-client';
import enContent from '@/content/en.json';

vi.mock('next/dynamic', () => ({
  default: () =>
    ({
      content,
    }: {
      content: { title: string };
    }) => <div data-testid='lazy-testimonials'>{content.title}</div>,
}));

type ObserverCallback = IntersectionObserverCallback;

let observerCallback: ObserverCallback | null = null;
const observeMock = vi.fn();
const disconnectMock = vi.fn();
const originalIntersectionObserver = window.IntersectionObserver;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '500px 0px';
  readonly thresholds = [0];

  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }

  disconnect() {
    disconnectMock();
  }

  observe(_target: Element) {
    observeMock();
  }

  takeRecords() {
    return [];
  }

  unobserve(_target: Element) {}
}

function setIntersectionObserver(
  value: typeof IntersectionObserver | undefined,
) {
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value,
  });
}

describe('DeferredTestimonialsClient', () => {
  beforeEach(() => {
    observerCallback = null;
    observeMock.mockReset();
    disconnectMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    setIntersectionObserver(originalIntersectionObserver);
  });

  it('shows placeholder content until the section intersects', async () => {
    setIntersectionObserver(
      MockIntersectionObserver as unknown as typeof IntersectionObserver,
    );

    render(<DeferredTestimonialsClient content={enContent.testimonials} />);

    expect(
      screen.getByRole('heading', { name: enContent.testimonials.title }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('lazy-testimonials')).not.toBeInTheDocument();
    expect(observeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      observerCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(screen.queryByTestId('lazy-testimonials')).not.toBeInTheDocument();

    await act(async () => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('lazy-testimonials')).toBeInTheDocument();
    });
    expect(disconnectMock).toHaveBeenCalled();
  });
});
