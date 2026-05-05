import { mergeClassNames } from '@/lib/class-name-utils';

const DEFAULT_ICON_CLASS =
  'es-ui-icon-mask es-ui-icon-mask--chevron-right inline-block h-7 w-7 shrink-0 es-text-icon';

export function CarouselArrowIcon({
  direction,
  className,
}: {
  direction: 'left' | 'right';
  /** Optional sizing / tone classes (default matches MBA date carousel). */
  className?: string;
}) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <span
      aria-hidden
      className={mergeClassNames(DEFAULT_ICON_CLASS, rotationClass, className)}
    />
  );
}
