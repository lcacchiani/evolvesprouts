'use client';

import { useEffect } from 'react';

interface UseModalLockBodyOptions {
  isActive?: boolean;
  onEscape: () => void;
}

export function useModalLockBody({
  isActive = true,
  onEscape,
}: UseModalLockBodyOptions) {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onEscape();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isActive, onEscape]);
}
