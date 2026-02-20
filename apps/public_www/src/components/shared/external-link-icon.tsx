import type { ReactNode, SVGProps } from 'react';

interface ExternalLinkIconProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

interface ExternalLinkInlineContentProps {
  isExternalHttp: boolean;
  children: ReactNode;
  internalIcon?: ReactNode;
}

export function ExternalLinkIcon({
  className,
  ...svgProps
}: ExternalLinkIconProps) {
  const mergedClassName = className
    ? `es-link-external-icon ${className}`
    : 'es-link-external-icon';

  return (
    <svg
      aria-hidden='true'
      data-external-link-icon='true'
      viewBox='0 0 16 16'
      className={mergedClassName}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      {...svgProps}
    >
      <path
        d='M1 11L7 5'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        d='M2.5 5H7V9.5'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export function ExternalLinkInlineContent({
  isExternalHttp,
  children,
  internalIcon = null,
}: ExternalLinkInlineContentProps) {
  if (isExternalHttp) {
    return (
      <span className='es-link-external-label es-link-external-label--with-icon'>
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
