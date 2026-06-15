import { useMemo, useState, type KeyboardEvent, type RefObject } from 'react';

interface UseRovingTabindexKeyboardNavOptions<T extends HTMLElement> {
  itemCount: number;
  itemRefs: RefObject<Record<number, T | null>>;
  onIndexChange: (nextIndex: number) => void;
}

export function useRovingTabindexKeyboardNav<T extends HTMLElement>({
  itemCount,
  itemRefs,
  onIndexChange,
}: UseRovingTabindexKeyboardNavOptions<T>) {
  const [rovingIndex, setRovingIndex] = useState(0);
  const safeRovingIndex = useMemo(
    () => Math.min(rovingIndex, Math.max(0, itemCount - 1)),
    [itemCount, rovingIndex],
  );

  function handleItemKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.min(index + 1, itemCount - 1);
      setRovingIndex(next);
      onIndexChange(next);
      itemRefs.current[next]?.focus();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(index - 1, 0);
      setRovingIndex(next);
      onIndexChange(next);
      itemRefs.current[next]?.focus();
    }
  }

  return {
    rovingIndex: safeRovingIndex,
    setRovingIndex,
    handleItemKeyDown,
  };
}
