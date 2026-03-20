import type {
  AnchorHTMLAttributes,
  ReactNode,
} from 'react';

import {
  ButtonPrimitive,
  type ButtonPrimitiveVariant,
} from '@/components/shared/button-primitive';
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
  variant?: ButtonPrimitiveVariant;
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
    <span
      aria-hidden
      className='es-ui-icon-mask es-ui-icon-mask--chevron-right ml-2 inline-block h-5 w-5 shrink-0'
    />
  );
}

export function SectionCtaAnchor({
  href,
  className,
  variant = 'primary',
  openInNewTab,
  children,
  ...anchorProps
}: SectionCtaProps) {
  return (
    <ButtonPrimitive
      href={href}
      variant={variant}
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
