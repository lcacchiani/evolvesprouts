import type { ReactNode } from 'react';

import { mergeClassNames } from '@/lib/class-name-utils';

interface PlaceholderPanelProps {
  children: ReactNode;
  className?: string;
}

const BASE_PLACEHOLDER_PANEL_CLASSNAME =
  'w-full rounded-2xl border border-black/10 bg-white/70 p-8 text-center shadow-sm sm:p-10 lg:p-12';

export function PlaceholderPanel({
  children,
  className,
}: PlaceholderPanelProps) {
  return (
    <section className={mergeClassNames(BASE_PLACEHOLDER_PANEL_CLASSNAME, className)}>
      {children}
    </section>
  );
}
