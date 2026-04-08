'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query. On the client, the initial state reads
 * `matchMedia` synchronously; on the server it stays false (mobile-first).
 */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia(query);
    function update() {
      setMatches(media.matches);
    }

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return matches;
}
