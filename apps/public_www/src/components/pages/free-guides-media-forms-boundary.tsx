'use client';

import type { ReactNode } from 'react';

import { MediaFormProvider } from '@/components/sections/shared/media-form-context';

/**
 * Client boundary for page-scoped MediaForm state on the free guides page.
 * Keeps `free-guides-and-resources.tsx` as a server component without importing
 * the provider module directly.
 */
export function FreeGuidesMediaFormsBoundary({ children }: { children: ReactNode }) {
  return <MediaFormProvider>{children}</MediaFormProvider>;
}
