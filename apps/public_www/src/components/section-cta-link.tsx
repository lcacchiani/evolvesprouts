import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

const BASE_SECTION_CTA_CLASSNAME =
  'es-cta-primary es-cta-button es-focus-ring';

interface SectionCtaProps {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

function buildClassName(className?: string): string {
  if (!className) {
    return BASE_SECTION_CTA_CLASSNAME;
  }

  return `${BASE_SECTION_CTA_CLASSNAME} ${className}`;
}

export function SectionCtaLink({
  href,
  className,
  style,
  children,
}: SectionCtaProps) {
  return (
    <Link href={href} className={buildClassName(className)} style={style}>
      {children}
    </Link>
  );
}

export function SectionCtaAnchor({
  href,
  className,
  style,
  children,
}: SectionCtaProps) {
  return (
    <a href={href} className={buildClassName(className)} style={style}>
      {children}
    </a>
  );
}
