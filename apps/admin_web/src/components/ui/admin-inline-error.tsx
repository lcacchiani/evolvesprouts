import type { ReactNode } from 'react';
import { clsx } from 'clsx';

const sizeStyles = {
  sm: 'text-sm',
  xs: 'text-xs',
};

export interface AdminInlineErrorProps {
  children: ReactNode;
  className?: string;
  size?: keyof typeof sizeStyles;
  role?: 'alert' | 'status';
}

export function AdminInlineError({
  children,
  className,
  size = 'sm',
  role = 'alert',
}: AdminInlineErrorProps) {
  return (
    <p role={role} className={clsx(sizeStyles[size], 'text-red-600', className)}>
      {children}
    </p>
  );
}
