import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSwipePager } from '@/lib/hooks/use-swipe-pager';

function HookHarness({ itemCount }: { itemCount: number }) {
  const {
    activeIndex,
    hasMultiplePages,
    goToPrevious,
    goToNext,
    handleTouchStart,
    handleTouchEnd,
    handleTouchCancel,
  } = useSwipePager<HTMLDivElement>({
    itemCount,
    swipeThresholdPx: 40,
  });

  return (
    <div>
      <div
        data-testid='swipe-region'
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      />
      <button type='button' onClick={goToPrevious}>
        Previous
      </button>
      <button type='button' onClick={goToNext}>
        Next
      </button>
      <span data-testid='active-index'>{activeIndex}</span>
      <span data-testid='has-multiple-pages'>{String(hasMultiplePages)}</span>
    </div>
  );
}

describe('useSwipePager', () => {
  it('wraps around when navigating with buttons', () => {
    render(<HookHarness itemCount={3} />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByTestId('active-index')).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('active-index')).toHaveTextContent('0');
  });

  it('uses touch swipe direction to navigate pages', () => {
    render(<HookHarness itemCount={3} />);
    const swipeRegion = screen.getByTestId('swipe-region');

    fireEvent.touchStart(swipeRegion, { changedTouches: [{ clientX: 120 }] });
    fireEvent.touchEnd(swipeRegion, { changedTouches: [{ clientX: 10 }] });
    expect(screen.getByTestId('active-index')).toHaveTextContent('1');

    fireEvent.touchStart(swipeRegion, { changedTouches: [{ clientX: 10 }] });
    fireEvent.touchEnd(swipeRegion, { changedTouches: [{ clientX: 120 }] });
    expect(screen.getByTestId('active-index')).toHaveTextContent('0');
  });

  it('ignores swipes below the configured threshold', () => {
    render(<HookHarness itemCount={3} />);
    const swipeRegion = screen.getByTestId('swipe-region');

    fireEvent.touchStart(swipeRegion, { changedTouches: [{ clientX: 100 }] });
    fireEvent.touchEnd(swipeRegion, { changedTouches: [{ clientX: 75 }] });

    expect(screen.getByTestId('active-index')).toHaveTextContent('0');
  });

  it('keeps single-page pagers static', () => {
    render(<HookHarness itemCount={1} />);
    const swipeRegion = screen.getByTestId('swipe-region');

    expect(screen.getByTestId('has-multiple-pages')).toHaveTextContent('false');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.touchStart(swipeRegion, { changedTouches: [{ clientX: 120 }] });
    fireEvent.touchEnd(swipeRegion, { changedTouches: [{ clientX: 10 }] });

    expect(screen.getByTestId('active-index')).toHaveTextContent('0');
  });
});
