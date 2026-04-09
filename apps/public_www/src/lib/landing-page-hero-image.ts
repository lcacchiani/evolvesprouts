/**
 * Shared defaults for landing-style hero imagery (photo + watermark wrapper).
 * Keeps event landing pages and the consultations hero aligned.
 */
export const DEFAULT_LANDING_PAGE_HERO_IMAGE_SRC =
  '/images/hero/child-landing-hero.webp';

export const LANDING_PAGE_HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT: Readonly<
  Record<number, string>
> = {
  50: 'max-w-[50%]',
  55: 'max-w-[55%]',
  60: 'max-w-[60%]',
  65: 'max-w-[65%]',
  70: 'max-w-[70%]',
  75: 'max-w-[75%]',
  80: 'max-w-[80%]',
  85: 'max-w-[85%]',
  90: 'max-w-[90%]',
  95: 'max-w-[95%]',
  100: 'max-w-[100%]',
  105: 'max-w-[105%]',
  110: 'max-w-[110%]',
  115: 'max-w-[115%]',
  120: 'max-w-[120%]',
};

export function resolveLandingPageHeroImageMaxWidthClass(
  imageMaxWidthPercent: number | undefined,
): string {
  if (
    typeof imageMaxWidthPercent !== 'number'
    || !Number.isFinite(imageMaxWidthPercent)
  ) {
    return LANDING_PAGE_HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[100];
  }

  const normalizedPercent = Math.round(imageMaxWidthPercent);
  return (
    LANDING_PAGE_HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[normalizedPercent]
    ?? LANDING_PAGE_HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[100]
  );
}
