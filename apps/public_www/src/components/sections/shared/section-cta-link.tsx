import type {
  AnchorHTMLAttributes,
  ReactNode,
} from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { ExternalLinkInlineContent } from '@/components/shared/external-link-icon';

const BASE_SECTION_CTA_CLASSNAME =
  'gap-0';

interface SectionCtaProps
  extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'className' | 'href' | 'style' | 'target' | 'rel'
  > {
  href: string;
  className?: string;
  openInNewTab?: boolean;
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
      className='ml-2 h-5 w-5 shrink-0'
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
  openInNewTab,
  children,
  ...anchorProps
}: SectionCtaProps) {
  return (
    <ButtonPrimitive
      href={href}
      variant='primary'
      className={buildClassName(className)}
      openInNewTab={openInNewTab}
      {...anchorProps}
    >
      {({ isExternalHttp }) => (
        <ExternalLinkInlineContent
          isExternalHttp={isExternalHttp}
          internalIcon={<CtaChevronIcon />}
        >
          {children}
        </ExternalLinkInlineContent>
      )}
    </ButtonPrimitive>
  );
}
