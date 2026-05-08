'use client';

import type { ReactNode } from 'react';

import { twMerge } from 'tailwind-merge';

export interface AdminTableToolbarProps {
  children: ReactNode;
  /** Bottom margin under the toolbar row; `none` for nested editor toolbars. */
  marginBottom?: 'default' | 'none';
  className?: string;
}

export function AdminTableToolbar({
  children,
  marginBottom = 'default',
  className,
}: AdminTableToolbarProps) {
  return (
    <div
      className={twMerge('flex flex-wrap items-end gap-3', marginBottom === 'default' && 'mb-3', className)}
    >
      {children}
    </div>
  );
}
