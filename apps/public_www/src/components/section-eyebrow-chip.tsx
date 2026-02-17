import type { CSSProperties } from 'react';
import Image from 'next/image';

interface SectionEyebrowChipProps {
  label: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
}

const BASE_CHIP_CLASSNAME =
  'es-section-eyebrow-chip inline-flex items-center gap-2 rounded-full border';
const CHIP_LOGO_SRC = '/images/evolvesprouts-logo.svg';
const CHIP_LOGO_SIZE = 31;

export function SectionEyebrowChip({
  label,
  labelClassName,
  labelStyle,
  className,
  style,
}: SectionEyebrowChipProps) {
  const chipClassName = className
    ? `${BASE_CHIP_CLASSNAME} ${className}`
    : BASE_CHIP_CLASSNAME;

  const labelTextClassName = labelClassName
    ? `es-type-eyebrow ${labelClassName}`
    : 'es-type-eyebrow';

  return (
    <div className={chipClassName} style={style}>
      <Image
        src={CHIP_LOGO_SRC}
        alt=''
        width={CHIP_LOGO_SIZE}
        height={CHIP_LOGO_SIZE}
        className='h-[31px] w-[31px] shrink-0'
      />
      <span className={labelTextClassName} style={labelStyle}>
        {label}
      </span>
    </div>
  );
}
