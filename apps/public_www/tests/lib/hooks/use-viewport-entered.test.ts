import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';

import { useViewportEntered } from '@/lib/hooks/use-viewport-entered';

const originalIntersectionObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

function installIntersectionObserverMock(
  onConstruct: (observer: {
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    callback: IntersectionObserverCallback;
  }) => void,
): void {
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn();
    root: Element | null = null;
    rootMargin = '';
    thresholds: ReadonlyArray<number> = [];

    constructor(public callback: IntersectionObserverCallback) {
      onConstruct(this);
    }
  }

  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

describe('useViewportEntered', () => {
  it('returns false before intersection', () => {
    let instance: {
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    } | null = null;

    installIntersectionObserverMock((observer) => {
      instance = observer;
    });

    const element = document.createElement('div');
    document.body.appendChild(element);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      ref.current = element;
      return useViewportEntered(ref, { threshold: 0.3 });
    });

    expect(result.current).toBe(false);
    expect(instance).not.toBeNull();
    expect(instance!.observe).toHaveBeenCalledWith(element);
    expect(instance!.disconnect).not.toHaveBeenCalled();

    document.body.removeChild(element);
  });

  it('returns true after intersection and disconnects the observer', async () => {
    let captured: {
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      callback: IntersectionObserverCallback;
    } | null = null;

    installIntersectionObserverMock((observer) => {
      captured = observer;
    });

    const element = document.createElement('div');
    document.body.appendChild(element);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      ref.current = element;
      return useViewportEntered(ref, { threshold: 0.3 });
    });

    expect(captured).not.toBeNull();
    expect(captured!.observe).toHaveBeenCalledWith(element);

    act(() => {
      captured!.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    expect(captured!.disconnect).toHaveBeenCalled();

    document.body.removeChild(element);
  });

  it('returns true when IntersectionObserver is unavailable (fallback)', async () => {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');

    const element = document.createElement('div');
    document.body.appendChild(element);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      ref.current = element;
      return useViewportEntered(ref);
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    document.body.removeChild(element);
  });
});
