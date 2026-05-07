'use client';

import type { ReactNode } from 'react';

import { clsx } from 'clsx';

export interface AdminTableToolbarProps {
  children: ReactNode;
  /** Omit default bottom margin (for example nested editor toolbars). */
  noMargin?: boolean;
  className?: string;
}

export function AdminTableToolbar({ children, noMargin, className }: AdminTableToolbarProps) {
  return (
    <div className={clsx('flex flex-wrap items-end gap-3', !noMargin && 'mb-3', className)}>{children}</div>
  );
}
