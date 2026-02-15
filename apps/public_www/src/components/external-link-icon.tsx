import type { SVGProps } from 'react';

interface ExternalLinkIconProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

export function ExternalLinkIcon({
  className = 'h-4 w-4 shrink-0',
  ...svgProps
}: ExternalLinkIconProps) {
  return (
    <svg
      aria-hidden='true'
      data-external-link-icon='true'
      viewBox='0 0 16 16'
      className={className}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      {...svgProps}
    >
      <path
        d='M5 11L11 5'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
      />
      <path
        d='M6.5 5H11V9.5'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}
