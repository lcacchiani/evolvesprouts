import type { CSSProperties, ReactNode } from 'react';

interface SectionShellProps {
  id?: string;
  ariaLabel: string;
  dataFigmaNode: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const BASE_SECTION_CLASSNAME =
  'w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-[100px]';

export function SectionShell({
  id,
  ariaLabel,
  dataFigmaNode,
  className,
  style,
  children,
}: SectionShellProps) {
  const sectionClassName = className
    ? `${BASE_SECTION_CLASSNAME} ${className}`
    : BASE_SECTION_CLASSNAME;

  return (
    <section
      id={id}
      aria-label={ariaLabel}
      data-figma-node={dataFigmaNode}
      className={sectionClassName}
      style={style}
    >
      {children}
    </section>
  );
}
