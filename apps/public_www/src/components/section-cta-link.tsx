import type {
  AnchorHTMLAttributes,
  CSSProperties,
  ReactNode,
} from 'react';

import { ExternalLinkIcon } from '@/components/external-link-icon';
import { SmartLink } from '@/components/smart-link';

const BASE_SECTION_CTA_CLASSNAME =
  'es-cta-primary es-cta-button es-primary-cta es-focus-ring gap-2';

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
        stroke='var(--es-color-surface-white, #FFFFFF)'
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
  return (
    <SmartLink
      href={href}
      className={buildClassName(className)}
      style={style}
      {...anchorProps}
    >
      {({ isExternalHttp }) => (
        <>
          <span className={isExternalHttp ? 'es-link-external-label' : undefined}>
            {children}
          </span>
          {isExternalHttp ? (
            <ExternalLinkIcon />
          ) : (
            <CtaChevronIcon />
          )}
        </>
      )}
    </SmartLink>
  );
}
