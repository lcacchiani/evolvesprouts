'use client';

import type { RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';

const HEIGHT_TRANSITION_MS = 320;

/**
 * When `enabled` and `changeKey` update, animates a block element's height from
 * its previous content height to the new height (before paint). Respects
 * `prefers-reduced-motion: reduce`.
 */
export function useHeightTransitionOnChange(
  enabled: boolean,
  changeKey: unknown,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const prevHeightRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      const el = ref.current;
      if (el) {
        el.style.height = '';
        el.style.transition = '';
      }
      prevHeightRef.current = null;
      return;
    }

    const el = ref.current;
    if (!el) {
      return;
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const nextHeight = el.scrollHeight;
    const prevHeight = prevHeightRef.current;

    if (
      prevHeight != null &&
      prevHeight !== nextHeight &&
      !reduceMotion
    ) {
      el.style.height = `${prevHeight}px`;
      void el.offsetHeight;
      el.style.transition = `height ${HEIGHT_TRANSITION_MS}ms ease-out`;
      el.style.height = `${nextHeight}px`;
    }

    prevHeightRef.current = nextHeight;
  }, [enabled, changeKey]);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const el = ref.current;
    if (!el) {
      return;
    }

    function onTransitionEnd(ev: TransitionEvent) {
      if (ev.propertyName !== 'height') {
        return;
      }
      const target = ev.currentTarget;
      if (!(target instanceof HTMLDivElement)) {
        return;
      }
      target.style.transition = '';
      target.style.height = '';
    }

    el.addEventListener('transitionend', onTransitionEnd);
    return () => el.removeEventListener('transitionend', onTransitionEnd);
  }, [enabled]);

  return ref;
}
