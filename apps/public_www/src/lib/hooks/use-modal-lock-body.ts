'use client';

import { useEffect, useId } from 'react';

interface UseModalLockBodyOptions {
  isActive?: boolean;
  onEscape: () => void;
}

const activeBodyLockTokens = new Set<string>();
let previousBodyOverflow = '';

function lockBodyScroll(token: string) {
  if (typeof document === 'undefined' || activeBodyLockTokens.has(token)) {
    return;
  }

  if (activeBodyLockTokens.size === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  activeBodyLockTokens.add(token);
}

function unlockBodyScroll(token: string) {
  if (typeof document === 'undefined' || !activeBodyLockTokens.has(token)) {
    return;
  }

  activeBodyLockTokens.delete(token);
  if (activeBodyLockTokens.size === 0) {
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = '';
  }
}

export function useModalLockBody({
  isActive = true,
  onEscape,
}: UseModalLockBodyOptions) {
  const lockToken = useId();

  useEffect(() => {
    if (!isActive) {
      return;
    }

    lockBodyScroll(lockToken);

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onEscape();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      unlockBodyScroll(lockToken);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isActive, lockToken, onEscape]);
}
