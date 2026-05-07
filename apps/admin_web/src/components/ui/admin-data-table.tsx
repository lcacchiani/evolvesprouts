'use client';

import type { ReactNode } from 'react';

import { clsx } from 'clsx';

export interface AdminDataTableProps {
  children: ReactNode;
  /** Applied to the table element (for example min width). */
  tableClassName?: string;
}

export function AdminDataTable({ children, tableClassName }: AdminDataTableProps) {
  return (
    <div className='rounded-md border border-slate-200'>
      <table className={clsx('w-full divide-y divide-slate-200 text-left', tableClassName)}>
        {children}
      </table>
    </div>
  );
}

export interface AdminDataTableHeadProps {
  children: ReactNode;
  sticky?: boolean;
}

export function AdminDataTableHead({ children, sticky }: AdminDataTableHeadProps) {
  return (
    <thead
      className={clsx(
        'bg-slate-100 text-xs uppercase tracking-[0.08em] text-slate-700',
        sticky && 'sticky top-0 z-10'
      )}
    >
      {children}
    </thead>
  );
}

export function AdminDataTableBody({ children }: { children: ReactNode }) {
  return <tbody className='divide-y divide-slate-200 bg-white text-sm'>{children}</tbody>;
}

export interface AdminDataTableOperationsHeadCellProps {
  children?: ReactNode;
  className?: string;
  scope?: 'col' | 'row';
}

/** Standard right-aligned operations column header for admin listing tables. */
export function AdminDataTableOperationsHeadCell({
  children = 'Operations',
  className,
  scope = 'col',
}: AdminDataTableOperationsHeadCellProps) {
  return (
    <th scope={scope} className={clsx('px-4 py-3 text-right font-semibold', className)}>
      {children}
    </th>
  );
}
