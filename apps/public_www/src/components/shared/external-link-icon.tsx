import type { ReactNode, SVGProps } from 'react';

import ExternalLinkSvg from '@/components/icons/svg/external-link-icon.svg';

interface ExternalLinkIconProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

interface ExternalLinkInlineContentProps {
  isExternalHttp: boolean;
  children: ReactNode;
  internalIcon?: ReactNode;
  externalLabelClassName?: string;
}

export function ExternalLinkIcon({
  className,
  ...svgProps
}: ExternalLinkIconProps) {
  const mergedClassName = className
    ? `es-link-external-icon ${className}`
    : 'es-link-external-icon';

  return <ExternalLinkSvg className={mergedClassName} {...svgProps} />;
}

export function ExternalLinkInlineContent({
  isExternalHttp,
  children,
  internalIcon = null,
  externalLabelClassName,
}: ExternalLinkInlineContentProps) {
  if (isExternalHttp) {
    const labelClassName = [
      'es-link-external-label',
      'es-link-external-label--with-icon',
      externalLabelClassName,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span className={labelClassName}>
        {children}
        <ExternalLinkIcon />
      </span>
    );
  }

  return (
    <>
      <span>{children}</span>
      {internalIcon}
    </>
  );
}
