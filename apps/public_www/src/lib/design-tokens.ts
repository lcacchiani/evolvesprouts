import type { CSSProperties } from 'react';

export const HEADING_TEXT_COLOR =
  'var(--site-heading-text, var(--figma-colors-join-our-sprouts-squad-community, #333333))';
export const BODY_TEXT_COLOR = 'var(--site-primary-text, var(--figma-colors-home, #4A4A4A))';
export const BRAND_ORANGE = 'var(--es-color-brand-orange, #C84A16)';
export const BRAND_ORANGE_STRONG = 'var(--es-color-brand-orange-strong, #E76C3D)';
export const BRAND_ORANGE_SOFT = 'var(--es-color-brand-orange-soft, #F2A975)';
export const BRAND_PEACH_BG = 'var(--es-color-brand-peach-bg, #FFF0E5)';
export const BRAND_PEACH_BORDER = 'var(--es-color-brand-peach-border, #EECAB0)';
export const SURFACE_WHITE = 'var(--es-color-surface-white, #FFFFFF)';
export const HEADING_FONT_FAMILY =
  'var(--figma-fontfamilies-poppins, Poppins), sans-serif';
export const BODY_FONT_FAMILY = 'var(--figma-fontfamilies-lato, Lato), sans-serif';

export const DEFAULT_SECTION_EYEBROW_STYLE: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: BODY_FONT_FAMILY,
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: '1',
};

function mergeStyle(
  baseStyle: CSSProperties,
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return overrides ? { ...baseStyle, ...overrides } : baseStyle;
}

export function headingTextStyle(
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return mergeStyle(
    {
      color: HEADING_TEXT_COLOR,
      fontFamily: HEADING_FONT_FAMILY,
      fontWeight: 700,
      lineHeight: 1.2,
    },
    overrides,
  );
}

export function bodyTextStyle(
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return mergeStyle(
    {
      color: BODY_TEXT_COLOR,
      fontFamily: BODY_FONT_FAMILY,
      fontWeight: 400,
      lineHeight: 1.5,
    },
    overrides,
  );
}

export function eyebrowTextStyle(
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return mergeStyle(DEFAULT_SECTION_EYEBROW_STYLE, overrides);
}

export function ctaTextStyle(
  overrides?: Partial<CSSProperties>,
): CSSProperties {
  return mergeStyle(
    {
      fontFamily: BODY_FONT_FAMILY,
      fontWeight: 600,
      lineHeight: 1,
    },
    overrides,
  );
}
