import type { ReactNode } from 'react';

interface PlaceholderPanelProps {
  children: ReactNode;
  className?: string;
}

function mergeClassNames(...values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
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
