interface BackgroundGlowProps {
  className?: string;
  backgroundClassName: string;
  opacityClassName?: string;
}

export function BackgroundGlow({
  className,
  backgroundClassName,
  opacityClassName,
}: BackgroundGlowProps) {
  const glowClassName = [
    'pointer-events-none absolute rounded-full',
    className,
    backgroundClassName,
    opacityClassName,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return <div aria-hidden='true' className={glowClassName} />;
}
