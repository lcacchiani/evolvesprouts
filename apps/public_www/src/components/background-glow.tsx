import type { CSSProperties } from 'react';

interface BackgroundGlowProps {
  className?: string;
  background: string;
  opacity?: number;
}

export function BackgroundGlow({
  className,
  background,
  opacity,
}: BackgroundGlowProps) {
  const glowClassName = className
    ? `pointer-events-none absolute rounded-full ${className}`
    : 'pointer-events-none absolute rounded-full';
  const glowStyle: CSSProperties = {
    background,
    ...(typeof opacity === 'number' ? { opacity } : {}),
  };

  return <div aria-hidden='true' className={glowClassName} style={glowStyle} />;
}
