interface LoadingGearIconProps {
  className?: string;
  testId?: string;
}

/**
 * Spinning gear mask icon (same asset as events loading). Pair with `animate-spin`
 * for indeterminate load states.
 */
export function LoadingGearIcon({ className, testId }: LoadingGearIconProps) {
  return (
    <span
      data-testid={testId}
      aria-hidden
      className={[
        'es-ui-icon-mask es-ui-icon-mask--loading-gear es-loading-gear-icon inline-block h-7 w-7',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
