'use client';

import type { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={clsx(
        'h-10 w-full min-w-0 rounded-md border border-slate-300 px-3 text-base',
        'text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none',
        'focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed',
        'disabled:bg-slate-100 sm:h-9 sm:text-sm',
        className
      )}
      {...props}
    />
  );
}
