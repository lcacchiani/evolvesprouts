import type {
  AnchorHTMLAttributes,
  CSSProperties,
  ReactNode,
} from 'react';
import Link from 'next/link';

import { isExternalHref } from '@/lib/url-utils';

const BASE_SECTION_CTA_CLASSNAME =
  'es-cta-primary es-cta-button es-focus-ring gap-2';

interface SectionCtaProps
  extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'className' | 'href' | 'style'
  > {
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

function CtaChevronIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 20 20'
      className='h-5 w-5 shrink-0'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M7 4L13 10L7 16'
        stroke='var(--figma-colors-desktop, #FFFFFF)'
        strokeWidth='2.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export function SectionCtaAnchor({
  href,
  className,
  style,
  children,
  ...anchorProps
}: SectionCtaProps) {
  const sharedProps = {
    className: buildClassName(className),
    style,
    ...anchorProps,
  };

  if (isExternalHref(href) || href.startsWith('#')) {
    return (
      <a href={href} {...sharedProps}>
        <span>{children}</span>
        <CtaChevronIcon />
      </a>
    );
  }

  return (
    <Link href={href} {...sharedProps}>
      <span>{children}</span>
      <CtaChevronIcon />
    </Link>
  );
}
