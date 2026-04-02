'use client';

import type { ReactNode } from 'react';

/**
 * Client boundary for the free guides page region that contains client-only
 * media form sections. Keeps `free-guides-and-resources.tsx` as a server
 * component without importing those section modules directly.
 */
export function FreeGuidesMediaFormsBoundary({ children }: { children: ReactNode }) {
  return children;
}
