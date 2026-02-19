'use client';

import { type RefObject, useEffect, useRef } from 'react';

interface UseModalFocusManagementOptions {
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isActive?: boolean;
  restoreFocus?: boolean;
}

const FOCUSABLE_ELEMENT_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR),
  ).filter((element) => {
    if (element.hasAttribute('disabled')) {
      return false;
    }

    return element.getAttribute('aria-hidden') !== 'true';
  });
}

function requestFocusFrame(callback: () => void): number {
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(callback, 0);
}

function cancelFocusFrame(frameId: number): void {
  if (typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(frameId);
    return;
  }

  window.clearTimeout(frameId);
}

export function useModalFocusManagement({
  containerRef,
  initialFocusRef,
  isActive = true,
  restoreFocus = true,
}: UseModalFocusManagementOptions) {
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || typeof document === 'undefined') {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    previousFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusFrameId = requestFocusFrame(() => {
      const focusTarget =
        initialFocusRef?.current ??
        getFocusableElements(container)[0] ??
        container;
      focusTarget.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') {
        return;
      }

      const activeContainer = containerRef.current;
      if (!activeContainer) {
        return;
      }

      const focusableElements = getFocusableElements(activeContainer);
      if (focusableElements.length === 0) {
        event.preventDefault();
        activeContainer.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement === firstElement ||
          !activeContainer.contains(activeElement)
        ) {
          event.preventDefault();
          lastElement.focus();
        }

        return;
      }

      if (
        activeElement === lastElement ||
        !activeContainer.contains(activeElement)
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelFocusFrame(focusFrameId);
      window.removeEventListener('keydown', handleKeyDown);

      if (!restoreFocus) {
        return;
      }

      const previouslyFocusedElement = previousFocusedElementRef.current;
      if (previouslyFocusedElement && previouslyFocusedElement.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, [containerRef, initialFocusRef, isActive, restoreFocus]);
}
