'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

type ScrollDirection = 'prev' | 'next';

interface UseHorizontalCarouselOptions {
  itemCount: number;
  minItemsForNavigation?: number;
  scrollThresholdPx?: number;
  scrollStepRatio?: number;
  minScrollStepPx?: number;
}

interface UseHorizontalCarouselResult<T extends HTMLElement> {
  carouselRef: RefObject<T | null>;
  hasNavigation: boolean;
  canScrollPrevious: boolean;
  canScrollNext: boolean;
  updateNavigationState: () => void;
  scrollByDirection: (direction: ScrollDirection) => void;
  scrollItemIntoView: (
    item: Element | null,
    behavior?: ScrollBehavior,
  ) => void;
}

const DEFAULT_SCROLL_THRESHOLD_PX = 2;
const DEFAULT_SCROLL_STEP_RATIO = 0.8;
const DEFAULT_MIN_SCROLL_STEP_PX = 180;
const DEFAULT_MIN_ITEMS_FOR_NAVIGATION = 1;

function resolveScrollStep(
  carouselElement: HTMLElement,
  {
    scrollStepRatio,
    minScrollStepPx,
  }: {
    scrollStepRatio: number;
    minScrollStepPx: number;
  },
): number {
  return Math.max(
    minScrollStepPx,
    Math.round(carouselElement.clientWidth * scrollStepRatio),
  );
}

export function useHorizontalCarousel<T extends HTMLElement>({
  itemCount,
  minItemsForNavigation = DEFAULT_MIN_ITEMS_FOR_NAVIGATION,
  scrollThresholdPx = DEFAULT_SCROLL_THRESHOLD_PX,
  scrollStepRatio = DEFAULT_SCROLL_STEP_RATIO,
  minScrollStepPx = DEFAULT_MIN_SCROLL_STEP_PX,
}: UseHorizontalCarouselOptions): UseHorizontalCarouselResult<T> {
  const carouselRef = useRef<T | null>(null);
  const hasNavigation = itemCount > minItemsForNavigation;
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(hasNavigation);

  const updateNavigationState = useCallback(() => {
    const carouselElement = carouselRef.current;
    if (!carouselElement || !hasNavigation) {
      setCanScrollPrevious(false);
      setCanScrollNext(false);
      return;
    }

    const maxScrollLeft = carouselElement.scrollWidth - carouselElement.clientWidth;
    if (maxScrollLeft <= scrollThresholdPx) {
      setCanScrollPrevious(false);
      setCanScrollNext(false);
      return;
    }

    setCanScrollPrevious(carouselElement.scrollLeft > scrollThresholdPx);
    setCanScrollNext(
      carouselElement.scrollLeft < maxScrollLeft - scrollThresholdPx,
    );
  }, [hasNavigation, scrollThresholdPx]);

  const scrollByDirection = useCallback(
    (direction: ScrollDirection) => {
      const carouselElement = carouselRef.current;
      if (!carouselElement) {
        return;
      }

      if (direction === 'prev' && !canScrollPrevious) {
        return;
      }

      if (direction === 'next' && !canScrollNext) {
        return;
      }

      const scrollStep = resolveScrollStep(carouselElement, {
        scrollStepRatio,
        minScrollStepPx,
      });
      const leftOffset = direction === 'prev' ? -scrollStep : scrollStep;

      carouselElement.scrollBy({
        left: leftOffset,
        behavior: 'smooth',
      });
    },
    [
      canScrollNext,
      canScrollPrevious,
      minScrollStepPx,
      scrollStepRatio,
    ],
  );

  const scrollItemIntoView = useCallback(
    (item: Element | null, behavior: ScrollBehavior = 'smooth') => {
      if (!item) {
        return;
      }

      item.scrollIntoView({
        behavior,
        block: 'nearest',
        inline: 'center',
      });

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          updateNavigationState();
        });
      }
    },
    [updateNavigationState],
  );

  useEffect(() => {
    const carouselElement = carouselRef.current;
    if (!carouselElement) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      updateNavigationState();
    });

    function handleScroll() {
      updateNavigationState();
    }

    carouselElement.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.cancelAnimationFrame(frameId);
      carouselElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [itemCount, updateNavigationState]);

  return {
    carouselRef,
    hasNavigation,
    canScrollPrevious,
    canScrollNext,
    updateNavigationState,
    scrollByDirection,
    scrollItemIntoView,
  };
}
