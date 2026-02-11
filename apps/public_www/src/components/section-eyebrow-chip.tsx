import type { CSSProperties, ReactNode } from 'react';

interface SectionEyebrowChipProps {
  label: string;
  labelStyle?: CSSProperties;
  icon: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const BASE_CHIP_CLASSNAME = 'inline-flex items-center gap-2 rounded-full border';

export function SectionEyebrowChip({
  label,
  labelStyle,
  icon,
  className,
  style,
}: SectionEyebrowChipProps) {
  const chipClassName = className
    ? `${BASE_CHIP_CLASSNAME} ${className}`
    : BASE_CHIP_CLASSNAME;

  return (
    <div className={chipClassName} style={style}>
      {icon}
      <span style={labelStyle}>{label}</span>
    </div>
  );
}
