'use client';

import { type RefObject, useEffect } from 'react';

interface UseOutsideClickCloseOptions<T extends HTMLElement> {
  ref: RefObject<T | null>;
  onOutsideClick: () => void;
  isActive?: boolean;
}

export function useOutsideClickClose<T extends HTMLElement>({
  ref,
  onOutsideClick,
  isActive = true,
}: UseOutsideClickCloseOptions<T>) {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!ref.current?.contains(target)) {
        onOutsideClick();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isActive, onOutsideClick, ref]);
}
