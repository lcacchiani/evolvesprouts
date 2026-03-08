'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

type ScrollDirection = 'prev' | 'next';

interface UseHorizontalCarouselOptions {
  itemCount: number;
  minItemsForNavigation?: number;
  scrollThresholdPx?: number;
  scrollStepRatio?: number;
  minScrollStepPx?: number;
  loop?: boolean;
  snapToItem?: boolean;
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
const LOOP_SETTLE_DELAY_MS = 400;
const LOOP_COOLDOWN_MS = 1500;

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

function resolveItemScrollPositions(container: HTMLElement): number[] {
  const wrapper = container.firstElementChild;
  if (!wrapper) {
    return [];
  }

  const containerRect = container.getBoundingClientRect();
  const currentScrollLeft = container.scrollLeft;
  const positions: number[] = [];

  for (const child of wrapper.children) {
    const childRect = child.getBoundingClientRect();
    positions.push(
      Math.round(childRect.left - containerRect.left + currentScrollLeft),
    );
  }

  return positions;
}

export function useHorizontalCarousel<T extends HTMLElement>({
  itemCount,
  minItemsForNavigation = DEFAULT_MIN_ITEMS_FOR_NAVIGATION,
  scrollThresholdPx = DEFAULT_SCROLL_THRESHOLD_PX,
  scrollStepRatio = DEFAULT_SCROLL_STEP_RATIO,
  minScrollStepPx = DEFAULT_MIN_SCROLL_STEP_PX,
  loop = false,
  snapToItem = false,
}: UseHorizontalCarouselOptions): UseHorizontalCarouselResult<T> {
  const carouselRef = useRef<T | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const lastScrollLeftRef = useRef(-1);
  const loopSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    if (loop) {
      setCanScrollPrevious(true);
      setCanScrollNext(true);
      return;
    }

    setCanScrollPrevious(carouselElement.scrollLeft > scrollThresholdPx);
    setCanScrollNext(
      carouselElement.scrollLeft < maxScrollLeft - scrollThresholdPx,
    );
  }, [hasNavigation, loop, scrollThresholdPx]);

  const teleportScroll = useCallback((element: HTMLElement, targetLeft: number) => {
    element.style.scrollSnapType = 'none';
    element.scrollLeft = targetLeft;
    void element.offsetHeight;
    element.style.scrollSnapType = '';
  }, []);

  const beginLoopCooldown = useCallback(() => {
    isAutoScrollingRef.current = true;
    if (loopCooldownTimerRef.current !== null) {
      clearTimeout(loopCooldownTimerRef.current);
    }
    loopCooldownTimerRef.current = setTimeout(() => {
      loopCooldownTimerRef.current = null;
      isAutoScrollingRef.current = false;
    }, LOOP_COOLDOWN_MS);
  }, []);

  const scrollByDirection = useCallback(
    (direction: ScrollDirection) => {
      const carouselElement = carouselRef.current;
      if (!carouselElement) {
        return;
      }

      const maxScrollLeft = carouselElement.scrollWidth - carouselElement.clientWidth;
      if (loop && maxScrollLeft > scrollThresholdPx) {
        if (
          direction === 'prev' &&
          carouselElement.scrollLeft <= scrollThresholdPx
        ) {
          beginLoopCooldown();
          teleportScroll(carouselElement, maxScrollLeft);
          return;
        }

        if (
          direction === 'next' &&
          carouselElement.scrollLeft >= maxScrollLeft - scrollThresholdPx
        ) {
          beginLoopCooldown();
          teleportScroll(carouselElement, 0);
          return;
        }
      }

      if (direction === 'prev' && !canScrollPrevious) {
        return;
      }

      if (direction === 'next' && !canScrollNext) {
        return;
      }

      if (snapToItem) {
        const positions = resolveItemScrollPositions(carouselElement);
        if (positions.length === 0) {
          return;
        }

        const currentLeft = Math.round(carouselElement.scrollLeft);

        if (direction === 'next') {
          const nextPos = positions.find(
            (pos) => pos > currentLeft + scrollThresholdPx,
          );
          if (nextPos === undefined) {
            return;
          }
          carouselElement.scrollTo({
            left: Math.min(nextPos, maxScrollLeft),
            behavior: 'smooth',
          });
        } else {
          const prevPos = positions.findLast(
            (pos) => pos < currentLeft - scrollThresholdPx,
          );
          if (prevPos === undefined) {
            return;
          }
          carouselElement.scrollTo({
            left: Math.max(prevPos, 0),
            behavior: 'smooth',
          });
        }

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
      beginLoopCooldown,
      canScrollNext,
      canScrollPrevious,
      loop,
      minScrollStepPx,
      scrollStepRatio,
      scrollThresholdPx,
      snapToItem,
      teleportScroll,
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
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
        }

        rafIdRef.current = window.requestAnimationFrame(() => {
          rafIdRef.current = null;
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

    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      updateNavigationState();
    });

    function handleScroll() {
      updateNavigationState();

      if (!loop || isAutoScrollingRef.current) {
        return;
      }

      const element = carouselRef.current;
      if (!element) {
        return;
      }

      const currentScrollLeft = element.scrollLeft;
      const previousScrollLeft = lastScrollLeftRef.current;
      lastScrollLeftRef.current = currentScrollLeft;

      if (previousScrollLeft < 0) {
        return;
      }

      const scrollingForward = currentScrollLeft >= previousScrollLeft;

      if (loopSettleTimerRef.current !== null) {
        clearTimeout(loopSettleTimerRef.current);
      }

      loopSettleTimerRef.current = setTimeout(() => {
        loopSettleTimerRef.current = null;

        const el = carouselRef.current;
        if (!el || isAutoScrollingRef.current) {
          return;
        }

        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= scrollThresholdPx) {
          return;
        }

        if (
          scrollingForward &&
          el.scrollLeft >= maxScroll - scrollThresholdPx
        ) {
          beginLoopCooldown();
          teleportScroll(el, 0);
        } else if (
          !scrollingForward &&
          el.scrollLeft <= scrollThresholdPx
        ) {
          beginLoopCooldown();
          teleportScroll(el, maxScroll);
        }
      }, LOOP_SETTLE_DELAY_MS);
    }

    carouselElement.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (loopSettleTimerRef.current !== null) {
        clearTimeout(loopSettleTimerRef.current);
        loopSettleTimerRef.current = null;
      }
      if (loopCooldownTimerRef.current !== null) {
        clearTimeout(loopCooldownTimerRef.current);
        loopCooldownTimerRef.current = null;
      }
      carouselElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [beginLoopCooldown, itemCount, loop, scrollThresholdPx, teleportScroll, updateNavigationState]);

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
