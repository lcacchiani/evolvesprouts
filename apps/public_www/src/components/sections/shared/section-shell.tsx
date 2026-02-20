import type { ReactNode } from 'react';

interface SectionShellProps {
  id?: string;
  ariaLabel: string;
  dataFigmaNode: string;
  className?: string;
  children: ReactNode;
}

const BASE_SECTION_CLASSNAME = 'w-full es-section-shell-spacing';

export function SectionShell({
  id,
  ariaLabel,
  dataFigmaNode,
  className,
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
    >
      {children}
    </section>
  );
}
