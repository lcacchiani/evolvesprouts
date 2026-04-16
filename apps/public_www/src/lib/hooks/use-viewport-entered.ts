'use client';

import { type RefObject, useEffect, useState } from 'react';

export function useViewportEntered(
  ref: RefObject<HTMLElement | null>,
  options?: { threshold?: number; rootMargin?: string },
): boolean {
  const [hasEntered, setHasEntered] = useState(false);
  const threshold = options?.threshold ?? 0;
  const rootMargin = options?.rootMargin;

  useEffect(() => {
    if (hasEntered) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      const timeoutId = window.setTimeout(() => {
        setHasEntered(true);
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry || !entry.isIntersecting) {
          return;
        }

        setHasEntered(true);
        observer.disconnect();
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [hasEntered, ref, threshold, rootMargin]);

  return hasEntered;
}
