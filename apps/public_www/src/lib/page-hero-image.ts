/**
 * Max-width class helpers for split-column hero imagery (photo + watermark wrap).
 * Callers supply the picture config (including `imageSrc`); only sizing is derived here.
 */
export type HeroPictureInput = {
  imageSrc: string;
  imageMaxWidthPercent?: number;
};

const HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT: Readonly<Record<number, string>> = {
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

export function resolveHeroImageMaxWidthClass(
  picture: HeroPictureInput,
): string {
  const { imageMaxWidthPercent } = picture;
  if (
    typeof imageMaxWidthPercent !== 'number'
    || !Number.isFinite(imageMaxWidthPercent)
  ) {
    return HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[100];
  }

  const normalizedPercent = Math.round(imageMaxWidthPercent);
  return (
    HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[normalizedPercent]
    ?? HERO_IMAGE_MAX_WIDTH_CLASS_BY_PERCENT[100]
  );
}
