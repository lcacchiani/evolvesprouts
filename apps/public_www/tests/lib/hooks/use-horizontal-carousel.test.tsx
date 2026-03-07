import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';

interface HarnessProps {
  itemCount: number;
  minItemsForNavigation?: number;
  loop?: boolean;
}

function HookHarness({
  itemCount,
  minItemsForNavigation,
  loop,
}: HarnessProps) {
  const {
    carouselRef,
    hasNavigation,
    canScrollPrevious,
    canScrollNext,
    scrollByDirection,
    scrollItemIntoView,
  } = useHorizontalCarousel<HTMLDivElement>({
    itemCount,
    minItemsForNavigation,
    loop,
  });
  const targetRef = useRef<HTMLDivElement | null>(null);

  return (
    <div>
      <div ref={carouselRef} data-testid='track' />
      <div ref={targetRef} data-testid='target' />
      <button type='button' onClick={() => scrollByDirection('prev')}>
        Scroll previous
      </button>
      <button type='button' onClick={() => scrollByDirection('next')}>
        Scroll next
      </button>
      <button
        type='button'
        onClick={() => {
          scrollItemIntoView(targetRef.current, 'auto');
        }}
      >
        Scroll item
      </button>
      <span data-testid='state'>
        {`${String(hasNavigation)}|${String(canScrollPrevious)}|${String(canScrollNext)}`}
      </span>
    </div>
  );
}

function defineTrackMetrics(track: HTMLElement, metrics: {
  clientWidth: number;
  scrollWidth: number;
  initialScrollLeft?: number;
}) {
  let scrollLeft = metrics.initialScrollLeft ?? 0;
  const scrollBySpy = vi.fn(({ left }: { left: number }) => {
    scrollLeft += left;
  });
  const scrollToSpy = vi.fn(({ left }: { left: number }) => {
    scrollLeft = left;
  });

  Object.defineProperty(track, 'clientWidth', {
    configurable: true,
    get: () => metrics.clientWidth,
  });
  Object.defineProperty(track, 'scrollWidth', {
    configurable: true,
    get: () => metrics.scrollWidth,
  });
  Object.defineProperty(track, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  Object.defineProperty(track, 'scrollBy', {
    configurable: true,
    value: scrollBySpy,
  });
  Object.defineProperty(track, 'scrollTo', {
    configurable: true,
    value: scrollToSpy,
  });

  return {
    scrollBySpy,
    scrollToSpy,
    setScrollLeft: (value: number) => {
      scrollLeft = value;
    },
  };
}

describe('useHorizontalCarousel', () => {
  it('disables navigation when item count does not pass the threshold', () => {
    render(<HookHarness itemCount={1} />);

    expect(screen.getByTestId('state')).toHaveTextContent('false|false|false');
  });

  it('updates previous/next navigation state on resize and scroll', async () => {
    render(<HookHarness itemCount={5} />);

    const track = screen.getByTestId('track');
    const { setScrollLeft } = defineTrackMetrics(track, {
      clientWidth: 400,
      scrollWidth: 1000,
      initialScrollLeft: 0,
    });

    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('true|false|true');
    });

    setScrollLeft(600);
    fireEvent.scroll(track);
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('true|true|false');
    });
  });

  it('uses the shared viewport-based scroll step when navigating', async () => {
    render(<HookHarness itemCount={5} />);

    const track = screen.getByTestId('track');
    const { scrollBySpy } = defineTrackMetrics(track, {
      clientWidth: 500,
      scrollWidth: 1600,
      initialScrollLeft: 0,
    });

    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('true|false|true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Scroll next' }));

    expect(scrollBySpy).toHaveBeenCalledWith({
      left: 400,
      behavior: 'smooth',
    });
  });

  it('loops from start/end boundaries when loop mode is enabled', async () => {
    render(<HookHarness itemCount={5} loop />);

    const track = screen.getByTestId('track');
    const { scrollToSpy, setScrollLeft } = defineTrackMetrics(track, {
      clientWidth: 400,
      scrollWidth: 1000,
      initialScrollLeft: 0,
    });

    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('true|true|true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Scroll previous' }));
    expect(scrollToSpy).toHaveBeenCalledWith({
      left: 600,
      behavior: 'smooth',
    });

    setScrollLeft(600);
    fireEvent.scroll(track);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll next' }));
    expect(scrollToSpy).toHaveBeenCalledWith({
      left: 0,
      behavior: 'smooth',
    });
  });

  it('auto-loops on scroll settle when loop is enabled and user swipes to boundary', () => {
    vi.useFakeTimers();
    try {
      render(<HookHarness itemCount={5} loop />);

      const track = screen.getByTestId('track');
      const { scrollToSpy, setScrollLeft } = defineTrackMetrics(track, {
        clientWidth: 400,
        scrollWidth: 1000,
        initialScrollLeft: 0,
      });

      vi.advanceTimersByTime(20);

      setScrollLeft(200);
      fireEvent.scroll(track);
      setScrollLeft(400);
      fireEvent.scroll(track);
      setScrollLeft(600);
      fireEvent.scroll(track);

      vi.advanceTimersByTime(500);
      expect(scrollToSpy).toHaveBeenCalledWith({
        left: 0,
        behavior: 'smooth',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not auto-loop from start on initial render', () => {
    vi.useFakeTimers();
    try {
      render(<HookHarness itemCount={5} loop />);

      const track = screen.getByTestId('track');
      const { scrollToSpy } = defineTrackMetrics(track, {
        clientWidth: 400,
        scrollWidth: 1000,
        initialScrollLeft: 0,
      });

      vi.advanceTimersByTime(2000);

      expect(scrollToSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('can scroll an item into view with centered alignment', () => {
    render(<HookHarness itemCount={5} />);

    const target = screen.getByTestId('target');
    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(target, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Scroll item' }));

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'nearest',
      inline: 'center',
    });
  });
});
