import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

const BASE_SECTION_CTA_CLASSNAME =
  'es-cta-primary inline-flex items-center justify-center text-center transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

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
