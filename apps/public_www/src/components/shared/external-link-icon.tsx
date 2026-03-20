import type { HTMLAttributes, ReactNode } from 'react';

interface ExternalLinkIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  className?: string;
}

interface ExternalLinkInlineContentProps {
  isExternalHttp: boolean;
  children: ReactNode;
  internalIcon?: ReactNode;
  externalLabelClassName?: string;
}

export function ExternalLinkIcon({ className, ...props }: ExternalLinkIconProps) {
  const mergedClassName = ['es-ui-icon-mask es-ui-icon-mask--external-link es-link-external-icon', className]
    .filter(Boolean)
    .join(' ');

  return <span aria-hidden className={mergedClassName} {...props} />;
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
