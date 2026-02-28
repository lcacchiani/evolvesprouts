import type { LabelHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return <label className={clsx('mb-1 block text-sm font-medium text-slate-700', className)} {...props} />;
}
