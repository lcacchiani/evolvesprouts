import type { ReactNode } from 'react';

import { clsx } from 'clsx';

export type DashboardCardWidth = 'half' | 'full';

export function DashboardCard({
  width,
  children,
  className,
}: {
  width: DashboardCardWidth;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        width === 'full' ? 'lg:col-span-2' : undefined,
        className,
      )}
    >
      {children}
    </section>
  );
}
