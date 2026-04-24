'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks which item key last completed a brief-success action (copy, draft duplicate, etc.),
 * clearing after `durationMs`. Use with row-scoped icon buttons that show a brief success state.
 */
export function useCopyFeedback(durationMs = 1000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  const markCopied = useCallback(
    (key: string) => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      setCopiedKey(key);
      timeoutRef.current = setTimeout(() => {
        setCopiedKey(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  return { copiedKey, markCopied };
}
