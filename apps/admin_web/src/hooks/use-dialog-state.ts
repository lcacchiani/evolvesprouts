'use client';

import { useCallback, useState } from 'react';

export function useDialogState(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return [isOpen, open, close] as const;
}
