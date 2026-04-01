'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface MediaFormContextValue {
  hasSubmitted: boolean;
  markFormSubmitted: () => void;
}

const MediaFormContext = createContext<MediaFormContextValue | undefined>(
  undefined,
);

export function MediaFormProvider({ children }: { children: ReactNode }) {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const markFormSubmitted = useCallback(() => {
    setHasSubmitted(true);
  }, []);

  const value = useMemo(
    () => ({ hasSubmitted, markFormSubmitted }),
    [hasSubmitted, markFormSubmitted],
  );

  return (
    <MediaFormContext.Provider value={value}>{children}</MediaFormContext.Provider>
  );
}

export function useMediaFormContext(): MediaFormContextValue | null {
  const ctx = useContext(MediaFormContext);
  if (ctx === undefined) {
    return null;
  }
  return ctx;
}
