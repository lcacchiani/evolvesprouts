'use client';

import { type TouchEvent, useCallback, useRef, useState } from 'react';

interface UseSwipePagerOptions {
  itemCount: number;
  swipeThresholdPx?: number;
}

interface UseSwipePagerResult<T extends HTMLElement> {
  activeIndex: number;
  hasMultiplePages: boolean;
  goToPrevious: () => void;
  goToNext: () => void;
  handleTouchStart: (event: TouchEvent<T>) => void;
  handleTouchEnd: (event: TouchEvent<T>) => void;
  handleTouchCancel: () => void;
}

const DEFAULT_SWIPE_THRESHOLD_PX = 48;

function getWrappedIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return ((index % total) + total) % total;
}

export function useSwipePager<T extends HTMLElement>({
  itemCount,
  swipeThresholdPx = DEFAULT_SWIPE_THRESHOLD_PX,
}: UseSwipePagerOptions): UseSwipePagerResult<T> {
  const hasMultiplePages = itemCount > 1;
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const goToPrevious = useCallback(() => {
    if (!hasMultiplePages) {
      return;
    }

    setActiveIndex((currentIndex) =>
      getWrappedIndex(currentIndex - 1, itemCount),
    );
  }, [hasMultiplePages, itemCount]);

  const goToNext = useCallback(() => {
    if (!hasMultiplePages) {
      return;
    }

    setActiveIndex((currentIndex) =>
      getWrappedIndex(currentIndex + 1, itemCount),
    );
  }, [hasMultiplePages, itemCount]);

  const handleTouchStart = useCallback(
    (event: TouchEvent<T>) => {
      if (!hasMultiplePages) {
        return;
      }

      const touch = event.changedTouches[0];
      touchStartXRef.current = touch ? touch.clientX : null;
    },
    [hasMultiplePages],
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent<T>) => {
      if (!hasMultiplePages || touchStartXRef.current === null) {
        touchStartXRef.current = null;
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch) {
        touchStartXRef.current = null;
        return;
      }

      const deltaX = touch.clientX - touchStartXRef.current;
      touchStartXRef.current = null;

      if (Math.abs(deltaX) < swipeThresholdPx) {
        return;
      }

      if (deltaX > 0) {
        goToPrevious();
        return;
      }

      goToNext();
    },
    [goToNext, goToPrevious, hasMultiplePages, swipeThresholdPx],
  );

  const handleTouchCancel = useCallback(() => {
    touchStartXRef.current = null;
  }, []);

  return {
    activeIndex: getWrappedIndex(activeIndex, itemCount),
    hasMultiplePages,
    goToPrevious,
    goToNext,
    handleTouchStart,
    handleTouchEnd,
    handleTouchCancel,
  };
}
